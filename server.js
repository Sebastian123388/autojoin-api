const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors({
    origin: ['https://roblox.com', 'https://web.roblox.com', '*'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 120, // máximo 120 requests por minuto
    message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

// CONFIGURAÇÕES
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// Cache avançado com timestamps
let cachedData = [];
let lastFetch = 0;
let lastError = null;
let totalRequests = 0;
let successRequests = 0;

const CACHE_TIME = 15000; // 15 segundos - mais agressivo
const MAX_MESSAGES = 100; // Mais mensagens para melhor detecção

// Sistema de saúde do servidor
let serverHealth = {
    status: 'starting',
    uptime: 0,
    discordConnected: false,
    lastDiscordCheck: 0,
    errorCount: 0,
    successCount: 0
};

// PADRÕES MELHORADOS PARA DETECÇÃO DE JOB IDS
const JOB_ID_PATTERNS = [
    // Padrões específicos do Brainrot Notify
    /Job\s*ID\s*\(Mobile\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    /Job\s*ID\s*\(iOS\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    /Job\s*ID\s*\(PC\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    /Job\s*ID\s*\(Desktop\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    
    // Padrões genéricos melhorados
    /Job\s*ID[:\s]*\(?([a-zA-Z0-9]{8,12})\)?/gi,
    /JobID[:\s]*([a-zA-Z0-9]{8,12})/gi,
    /Server\s*ID[:\s]*([a-zA-Z0-9]{8,12})/gi,
    /ID[:\s]*([a-zA-Z0-9]{8,12})/gi,
    
    // Padrões com diferentes separadores
    /Job\s*[-:=]\s*([a-zA-Z0-9]{8,12})/gi,
    /Server\s*[-:=]\s*([a-zA-Z0-9]{8,12})/gi,
    
    // Padrões para formatação Discord
    /```([a-zA-Z0-9]{8,12})```/gi,
    /`([a-zA-Z0-9]{8,12})`/gi,
    /\*\*([a-zA-Z0-9]{8,12})\*\*/gi,
    
    // Padrões com palavras-chave
    /(?:join|server|game)\s*(?:id|code)[:\s]*([a-zA-Z0-9]{8,12})/gi,
    
    // Padrão mais flexível (usar com cuidado)
    /\b([a-zA-Z0-9]{8,12})\b/gi,
    
    // Padrões de embed fields
    /(?:Job|Server|Game)\s*(?:ID|Code|Key)[:\s]*`?([a-zA-Z0-9]{8,12})`?/gi,
    
    // IDs sozinhos em linhas
    /\n\s*([a-zA-Z0-9]{8,12})\s*\n/gi,
];

// Buscar mensagens com retry automático
async function fetchDiscordMessages(retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔍 Tentativa ${attempt}/${retries} - Buscando mensagens do Discord...`);
            
            const response = await axios.get(
                `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=${MAX_MESSAGES}`,
                {
                    headers: {
                        'Authorization': `Bot ${DISCORD_TOKEN}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'GhostAutoJoin/3.1'
                    },
                    timeout: 10000 // 10 segundos timeout
                }
            );
            
            serverHealth.discordConnected = true;
            serverHealth.lastDiscordCheck = Date.now();
            serverHealth.successCount++;
            
            console.log(`✅ ${response.data.length} mensagens encontradas`);
            return response.data;
            
        } catch (error) {
            console.error(`❌ Tentativa ${attempt} falhou:`, error.response?.data || error.message);
            
            if (attempt === retries) {
                serverHealth.discordConnected = false;
                serverHealth.errorCount++;
                lastError = {
                    message: error.message,
                    timestamp: new Date().toISOString(),
                    status: error.response?.status || 'NETWORK_ERROR'
                };
            }
            
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            }
        }
    }
    
    return [];
}

// PROCESSAMENTO MELHORADO COM MAIS DEBUG
function processMessages(messages) {
    const processedData = [];
    const now = Date.now();
    const MAX_AGE = 20 * 60 * 1000; // 20 minutos máximo
    
    console.log(`🔄 Processando ${messages.length} mensagens...`);
    
    messages.forEach((message, index) => {
        const messageAge = now - new Date(message.timestamp).getTime();
        
        // Skip mensagens muito antigas
        if (messageAge > MAX_AGE) {
            return;
        }
        
        // Construir conteúdo completo
        let fullContent = '';
        
        // Adicionar conteúdo da mensagem
        if (message.content) {
            fullContent += message.content + '\n';
        }
        
        // Processar embeds com mais detalhes
        if (message.embeds && message.embeds.length > 0) {
            message.embeds.forEach(embed => {
                if (embed.title) fullContent += embed.title + '\n';
                if (embed.description) fullContent += embed.description + '\n';
                if (embed.fields) {
                    embed.fields.forEach(field => {
                        fullContent += `${field.name}: ${field.value}\n`;
                    });
                }
                if (embed.footer && embed.footer.text) fullContent += embed.footer.text + '\n';
            });
        }
        
        // Debug melhorado
        console.log(`📝 Mensagem ${index + 1}: "${fullContent.substring(0, 150)}..."`);
        
        // Tentar todos os padrões
        const foundJobIds = new Set();
        let platform = 'Unknown';
        let bestConfidence = 0;
        
        JOB_ID_PATTERNS.forEach((pattern, patternIndex) => {
            const matches = [...fullContent.matchAll(pattern)];
            
            matches.forEach(match => {
                const potentialJobId = match[1];
                
                // Validação mais flexível
                if (potentialJobId && /^[a-zA-Z0-9]{8,12}$/.test(potentialJobId)) {
                    // Evitar falsos positivos comuns
                    const lowerJobId = potentialJobId.toLowerCase();
                    const falsePositives = [
                        'javascript', 'undefined', 'function', 'document',
                        'username', 'password', 'admin123', 'test1234', 'localhost'
                    ];
                    
                    if (!falsePositives.some(fp => lowerJobId.includes(fp))) {
                        foundJobIds.add(potentialJobId);
                        console.log(`🎯 Padrão ${patternIndex + 1} encontrou: ${potentialJobId}`);
                        
                        // Determinar plataforma
                        if (/mobile|android|ios|iphone|ipad/i.test(fullContent)) {
                            platform = 'Mobile';
                        } else if (/pc|desktop|computer|windows|mac/i.test(fullContent)) {
                            platform = 'PC';
                        } else if (/xbox|console/i.test(fullContent)) {
                            platform = 'Console';
                        }
                        
                        // Calcular confiança
                        let confidence = 10;
                        if (/job\s*id/i.test(fullContent)) confidence += 30;
                        if (/server/i.test(fullContent)) confidence += 20;
                        if (/join/i.test(fullContent)) confidence += 15;
                        
                        bestConfidence = Math.max(bestConfidence, confidence);
                    }
                }
            });
        });
        
        // Fallback: busca mais simples se não encontrou nada
        if (foundJobIds.size === 0) {
            const fallbackMatches = fullContent.match(/\b[a-zA-Z0-9]{8,12}\b/g);
            if (fallbackMatches) {
                fallbackMatches.forEach(match => {
                    if (!/^\d+$/.test(match) && !/^[a-f0-9]+$/i.test(match)) { // Evitar números puros e hex
                        foundJobIds.add(match);
                        console.log(`🔄 Fallback encontrou: ${match}`);
                        bestConfidence = Math.max(bestConfidence, 5);
                    }
                });
            }
        }
        
        if (foundJobIds.size > 0) {
            // Extrair informações adicionais
            const extractInfo = (patterns, defaultValue = null) => {
                for (const pattern of patterns) {
                    const match = fullContent.match(pattern);
                    if (match && match[1]) return match[1].trim();
                }
                return defaultValue;
            };
            
            const serverName = extractInfo([
                /(?:Server\s*)?Name[:\s]*([^\n]+)/i,
                /\*\*(?:Name|Server)\*\*[:\s]*([^\n]+)/i,
                /Title[:\s]*([^\n]+)/i
            ]);
            
            const moneyPerSec = extractInfo([
                /Money\s*per\s*sec[:\s]*([^\n]+)/i,
                /\$\/s[:\s]*([^\n]+)/i,
                /Income[:\s]*([^\n]+)/i
            ]);
            
            const players = extractInfo([
                /Players?[:\s]*(\d+(?:\/\d+)?)/i,
                /(\d+\/\d+)\s*players?/i,
                /Online[:\s]*(\d+)/i
            ]);
            
            const processedEntry = {
                id: message.id,
                timestamp: message.timestamp,
                processed_at: new Date().toISOString(),
                age_minutes: Math.floor(messageAge / 60000),
                job_ids: Array.from(foundJobIds),
                platform: platform,
                server_name: serverName,
                money_per_sec: moneyPerSec,
                players: players,
                author: message.author.username,
                author_id: message.author.id,
                content_preview: fullContent.substring(0, 200),
                has_embeds: message.embeds && message.embeds.length > 0,
                embed_count: message.embeds ? message.embeds.length : 0,
                freshness_score: Math.max(0, 100 - (messageAge / 60000)),
                confidence: bestConfidence + (foundJobIds.size * 10),
                detection_method: 'enhanced'
            };
            
            processedData.push(processedEntry);
            console.log(`✅ ${foundJobIds.size} Job ID(s): [${Array.from(foundJobIds).join(', ')}] - Confiança: ${processedEntry.confidence}%`);
        } else {
            console.log(`❌ Nenhum Job ID na mensagem ${index + 1} de ${message.author.username}`);
        }
    });
    
    // Ordenar por confiança e freshness
    const sorted = processedData.sort((a, b) => {
        const scoreA = (a.freshness_score * 0.6) + (a.confidence * 0.4);
        const scoreB = (b.freshness_score * 0.6) + (b.confidence * 0.4);
        return scoreB - scoreA;
    });
    
    console.log(`🚀 Total processado: ${sorted.length} entradas válidas de ${messages.length} mensagens`);
    return sorted;
}

// ENDPOINT PRINCIPAL
app.get('/pets', async (req, res) => {
    totalRequests++;
    const now = Date.now();
    
    // Headers para otimização
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Timestamp': now,
        'X-Cache-Age': now - lastFetch,
        'X-Server-Health': serverHealth.status
    });
    
    // Verificar cache
    if (now - lastFetch < CACHE_TIME && cachedData.length > 0) {
        console.log(`📦 Cache hit - Idade: ${Math.floor((now - lastFetch) / 1000)}s`);
        successRequests++;
        return res.json({
            data: cachedData,
            cached: true,
            cache_age: now - lastFetch,
            timestamp: now,
            freshness: 'cached'
        });
    }
    
    try {
        console.log('🔄 Buscando dados frescos...');
        const messages = await fetchDiscordMessages();
        
        if (messages.length === 0) {
            return res.status(503).json({
                error: 'Discord API unavailable',
                cached_data: cachedData,
                use_cache: cachedData.length > 0,
                timestamp: now,
                last_error: lastError
            });
        }
        
        const processedData = processMessages(messages);
        
        // Atualizar cache
        cachedData = processedData;
        lastFetch = now;
        lastError = null;
        successRequests++;
        serverHealth.status = 'healthy';
        
        console.log(`🚀 Retornando ${processedData.length} entradas`);
        
        res.json({
            data: processedData,
            cached: false,
            total_entries: processedData.length,
            freshest_age: processedData[0] ? processedData[0].age_minutes : 0,
            timestamp: now,
            freshness: 'live',
            patterns_used: JOB_ID_PATTERNS.length
        });
        
    } catch (error) {
        console.error('❌ Erro crítico no endpoint:', error);
        
        res.status(500).json({
            error: 'Internal server error',
            cached_data: cachedData,
            use_cache: cachedData.length > 0,
            timestamp: now,
            error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    serverHealth.uptime = uptime;
    
    const healthStatus = {
        status: serverHealth.status,
        uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
            used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
        },
        discord: {
            connected: serverHealth.discordConnected,
            last_check: serverHealth.lastDiscordCheck,
            success_rate: `${Math.round((serverHealth.successCount / (serverHealth.successCount + serverHealth.errorCount)) * 100) || 0}%`
        },
        cache: {
            entries: cachedData.length,
            age: lastFetch ? `${Math.floor((Date.now() - lastFetch) / 1000)}s` : 'never',
            next_refresh: lastFetch ? `${Math.max(0, Math.floor((CACHE_TIME - (Date.now() - lastFetch)) / 1000))}s` : 'now'
        },
        requests: {
            total: totalRequests,
            success: successRequests,
            success_rate: `${Math.round((successRequests / totalRequests) * 100) || 0}%`
        },
        last_error: lastError
    };
    
    res.json(healthStatus);
});

// Debug melhorado
app.get('/debug', async (req, res) => {
    try {
        const messages = await fetchDiscordMessages();
        
        // Análise detalhada das primeiras mensagens
        const detailedAnalysis = messages.slice(0, 5).map(msg => {
            let fullContent = msg.content || '';
            
            if (msg.embeds) {
                msg.embeds.forEach(embed => {
                    if (embed.title) fullContent += '\n' + embed.title;
                    if (embed.description) fullContent += '\n' + embed.description;
                    if (embed.fields) {
                        embed.fields.forEach(field => {
                            fullContent += `\n${field.name}: ${field.value}`;
                        });
                    }
                });
            }
            
            // Testar cada padrão
            const patternResults = JOB_ID_PATTERNS.map((pattern, index) => {
                const matches = [...fullContent.matchAll(pattern)];
                return {
                    pattern_index: index,
                    pattern: pattern.source,
                    matches: matches.map(m => m[1]).filter(id => id && /^[a-zA-Z0-9]{8,12}$/.test(id))
                };
            }).filter(result => result.matches.length > 0);
            
            return {
                message_id: msg.id,
                author: msg.author.username,
                timestamp: msg.timestamp,
                age_minutes: Math.floor((Date.now() - new Date(msg.timestamp).getTime()) / 60000),
                content_length: fullContent.length,
                content_preview: fullContent.substring(0, 300),
                has_embeds: msg.embeds && msg.embeds.length > 0,
                pattern_matches: patternResults
            };
        });
        
        res.json({
            server_info: {
                version: 'Ghost AutoJoin v3.1 Enhanced',
                patterns_count: JOB_ID_PATTERNS.length,
                cache_time: CACHE_TIME,
                max_messages: MAX_MESSAGES
            },
            total_messages: messages.length,
            detailed_analysis: detailedAnalysis,
            processed_sample: cachedData.slice(0, 3),
            server_health: serverHealth
        });
        
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            processed_sample: cachedData.slice(0, 2)
        });
    }
});

// Refresh forçado
app.post('/refresh', async (req, res) => {
    try {
        lastFetch = 0; // Force cache miss
        const messages = await fetchDiscordMessages();
        const processedData = processMessages(messages);
        
        cachedData = processedData;
        lastFetch = Date.now();
        
        res.json({
            message: 'Cache refreshed successfully',
            entries: processedData.length,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to refresh cache',
            details: error.message
        });
    }
});

// Keep-alive
app.get('/keepalive', (req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Middleware de erro
app.use((error, req, res, next) => {
    console.error('❌ Erro não tratado:', error);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        available_endpoints: ['/pets', '/health', '/debug', '/refresh', '/keepalive']
    });
});

// Auto keep-alive para Render
if (process.env.RENDER_SERVICE_NAME) {
    setInterval(async () => {
        try {
            await axios.get(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/keepalive`);
            console.log('🏓 Keep-alive ping sent');
        } catch (error) {
            console.log('⚠️ Keep-alive ping failed');
        }
    }, 10 * 60 * 1000);
}

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Ghost AutoJoin Backend v3.1 Enhanced - Porta ${PORT}`);
    console.log(`🎯 Endpoints:`);
    console.log(`   • GET  /pets     - Dados principais`);
    console.log(`   • GET  /health   - Status do sistema`);
    console.log(`   • GET  /debug    - Debug detalhado`);
    console.log(`   • POST /refresh  - Força refresh`);
    console.log(`   • GET  /keepalive - Keep-alive`);
    
    console.log(`⚡ Configurações:`);
    console.log(`   • Cache: ${CACHE_TIME/1000}s`);
    console.log(`   • Mensagens: ${MAX_MESSAGES}`);
    console.log(`   • Padrões: ${JOB_ID_PATTERNS.length}`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('⚠️  CONFIGURE: DISCORD_TOKEN e CHANNEL_ID!');
        serverHealth.status = 'configuration_error';
    } else {
        console.log('✅ Configuração OK - Sistema operacional!');
        serverHealth.status = 'healthy';
    }
});
