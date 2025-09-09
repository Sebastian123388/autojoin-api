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

// PADRÕES APRIMORADOS PARA DETECÇÃO DE JOB IDS
const JOB_ID_PATTERNS = [
    // Padrões específicos do Brainrot Notify
    /Job\s*ID\s*\(Mobile\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    /Job\s*ID\s*\(iOS\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    /Job\s*ID\s*\(PC\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    /Job\s*ID\s*\(Desktop\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    
    // Padrões genéricos
    /Job\s*ID[:\s]*\(?([a-zA-Z0-9]{8,12})\)?/gi,
    /JobID[:\s]*([a-zA-Z0-9]{8,12})/gi,
    /Server\s*ID[:\s]*([a-zA-Z0-9]{8,12})/gi,
    
    // Padrões de embed fields
    /(?:Job|Server)\s*(?:ID|Code)[:\s]*([a-zA-Z0-9]{8,12})/gi,
    
    // Padrões específicos para formatos de bot
    /\*\*Job\s*ID\*\*[:\s]*`?([a-zA-Z0-9]{8,12})`?/gi,
    /`([a-zA-Z0-9]{8,12})`/g // IDs em backticks
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
                        'User-Agent': 'GhostAutoJoin/3.0'
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

// Processamento inteligente com múltiplos padrões
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
        
        // Combinar conteúdo da mensagem + embeds
        let fullContent = message.content || '';
        
        // Processar embeds
        if (message.embeds && message.embeds.length > 0) {
            message.embeds.forEach(embed => {
                if (embed.title) fullContent += '\n' + embed.title;
                if (embed.description) fullContent += '\n' + embed.description;
                if (embed.fields) {
                    embed.fields.forEach(field => {
                        fullContent += '\n' + field.name + ': ' + field.value;
                    });
                }
            });
        }
        
        // Tentar todos os padrões
        const foundJobIds = new Set();
        let platform = 'Unknown';
        
        JOB_ID_PATTERNS.forEach(pattern => {
            let match;
            const globalPattern = new RegExp(pattern.source, pattern.flags);
            
            while ((match = globalPattern.exec(fullContent)) !== null) {
                const jobId = match[1];
                
                // Validar Job ID (8-12 caracteres alfanuméricos)
                if (/^[a-zA-Z0-9]{8,12}$/.test(jobId)) {
                    foundJobIds.add(jobId);
                    
                    // Determinar plataforma
                    if (fullContent.includes('Mobile') || fullContent.includes('mobile')) platform = 'Mobile';
                    else if (fullContent.includes('iOS') || fullContent.includes('ios')) platform = 'iOS';
                    else if (fullContent.includes('PC') || fullContent.includes('Desktop')) platform = 'PC';
                }
            }
        });
        
        if (foundJobIds.size > 0) {
            // Extrair informações adicionais com padrões mais robustos
            const extractInfo = (patterns) => {
                for (const pattern of patterns) {
                    const match = fullContent.match(pattern);
                    if (match) return match[1].trim();
                }
                return null;
            };
            
            const serverName = extractInfo([
                /(?:Name|Server\s*Name)[:\s]*\n(.+)/i,
                /\*\*(?:Name|Server)\*\*[:\s]*(.+)/i,
                /Server[:\s]+(.+)/i
            ]);
            
            const moneyPerSec = extractInfo([
                /Money\s*per\s*sec[:\s]*\n(.+)/i,
                /\$\/s[:\s]*(.+)/i,
                /Money[:\s]*(.+)/i
            ]);
            
            const players = extractInfo([
                /Players[:\s]*\n(\d+\/\d+)/i,
                /\*\*Players\*\*[:\s]*(\d+\/\d+)/i,
                /(\d+\/\d+)\s*players/i
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
                freshness_score: Math.max(0, 100 - (messageAge / 60000)), // Score baseado na idade
                confidence: foundJobIds.size * 20 + (serverName ? 20 : 0) + (players ? 10 : 0) // Score de confiança
            };
            
            processedData.push(processedEntry);
            console.log(`🎯 JobIDs encontrados: [${Array.from(foundJobIds).join(', ')}] - Plataforma: ${platform} - Confiança: ${processedEntry.confidence}%`);
        }
    });
    
    // Ordenar por freshness e confidence
    const sorted = processedData.sort((a, b) => {
        const scoreA = a.freshness_score + (a.confidence / 10);
        const scoreB = b.freshness_score + (b.confidence / 10);
        return scoreB - scoreA;
    });
    
    console.log(`🚀 Total processado: ${sorted.length} entradas válidas`);
    return sorted;
}

// ENDPOINT PRINCIPAL ULTRA-OTIMIZADO
app.get('/pets', async (req, res) => {
    totalRequests++;
    const now = Date.now();
    const clientTimestamp = req.query.t || now;
    
    // Headers para otimização
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Timestamp': now,
        'X-Cache-Age': now - lastFetch,
        'X-Server-Health': serverHealth.status
    });
    
    // Verificar cache inteligente
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
        
        console.log(`🚀 Retornando ${processedData.length} entradas ultra-frescas`);
        
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

// Health check avançado
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

// Endpoint para força refresh
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

// Endpoint de debug completo
app.get('/debug', async (req, res) => {
    try {
        const messages = await fetchDiscordMessages();
        const rawSamples = messages.slice(0, 3).map(msg => ({
            id: msg.id,
            content: msg.content?.substring(0, 300) + '...',
            author: msg.author.username,
            timestamp: msg.timestamp,
            age_minutes: Math.floor((Date.now() - new Date(msg.timestamp).getTime()) / 60000),
            embeds: msg.embeds ? msg.embeds.map(embed => ({
                title: embed.title,
                description: embed.description?.substring(0, 100),
                fields_count: embed.fields ? embed.fields.length : 0
            })) : []
        }));
        
        res.json({
            server_info: {
                version: 'Ghost AutoJoin v3.0',
                patterns_count: JOB_ID_PATTERNS.length,
                cache_time: CACHE_TIME,
                max_messages: MAX_MESSAGES
            },
            raw_samples: rawSamples,
            processed_sample: cachedData.slice(0, 2),
            patterns: JOB_ID_PATTERNS.map((p, i) => `${i + 1}: ${p.source}`)
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            processed_sample: cachedData.slice(0, 2)
        });
    }
});

// Keep-alive otimizado para Render
app.get('/keepalive', (req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Middleware de erro global
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

// Auto keep-alive system
if (process.env.RENDER_SERVICE_NAME) {
    setInterval(async () => {
        try {
            await axios.get(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/keepalive`);
            console.log('🏓 Keep-alive ping sent');
        } catch (error) {
            console.log('⚠️ Keep-alive ping failed');
        }
    }, 10 * 60 * 1000); // 10 minutos
}

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Ghost AutoJoin Backend v3.0 - Porta ${PORT}`);
    console.log(`🎯 Endpoints disponíveis:`);
    console.log(`   • GET  /pets     - Dados principais (ultra-otimizado)`);
    console.log(`   • GET  /health   - Status completo do sistema`);
    console.log(`   • GET  /debug    - Debug detalhado`);
    console.log(`   • POST /refresh  - Força refresh do cache`);
    console.log(`   • GET  /keepalive - Keep-alive para Render`);
    
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
