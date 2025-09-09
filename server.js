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

// Rate limiting mais agressivo para velocidade
const limiter = rateLimit({
    windowMs: 30 * 1000, // 30 segundos
    max: 200, // máximo 200 requests em 30 segundos
    message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

// CONFIGURAÇÕES
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// Estatísticas simples (sem cache)
let totalRequests = 0;
let successRequests = 0;
let lastError = null;

const MAX_MESSAGES = 50; // Reduzido para velocidade
const MAX_AGE = 5 * 60 * 1000; // Apenas 5 minutos máximo - DADOS FRESCOS

// Sistema de saúde do servidor (simplificado)
let serverHealth = {
    status: 'starting',
    uptime: 0,
    discordConnected: false,
    lastDiscordCheck: 0,
    errorCount: 0,
    successCount: 0
};

// PADRÕES OTIMIZADOS PARA DETECÇÃO RÁPIDA DE JOB IDS
const JOB_ID_PATTERNS = [
    // Padrões mais específicos primeiro para velocidade
    /Job\s*ID\s*\((?:Mobile|iOS|PC|Desktop)\)[:\s]*\n([a-zA-Z0-9]{8,12})/gi,
    /Job\s*ID[:\s]*\(?([a-zA-Z0-9]{8,12})\)?/gi,
    /JobID[:\s]*([a-zA-Z0-9]{8,12})/gi,
    /Server\s*ID[:\s]*([a-zA-Z0-9]{8,12})/gi,
    
    // Formatação Discord
    /```([a-zA-Z0-9]{8,12})```/gi,
    /`([a-zA-Z0-9]{8,12})`/gi,
    /\*\*([a-zA-Z0-9]{8,12})\*\*/gi,
    
    // Embed fields
    /(?:Job|Server|Game)\s*(?:ID|Code|Key)[:\s]*`?([a-zA-Z0-9]{8,12})`?/gi,
    
    // Padrão geral (último para não sobrescrever específicos)
    /\b([a-zA-Z0-9]{8,12})\b/gi
];

// Buscar mensagens RÁPIDO com timeout baixo
async function fetchDiscordMessages() {
    try {
        console.log(`🚀 Buscando mensagens frescas...`);
        
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=${MAX_MESSAGES}`,
            {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'GhostAutoJoin/4.0-NoCache'
                },
                timeout: 5000 // 5 segundos timeout - RÁPIDO
            }
        );
        
        serverHealth.discordConnected = true;
        serverHealth.lastDiscordCheck = Date.now();
        serverHealth.successCount++;
        
        console.log(`⚡ ${response.data.length} mensagens encontradas em tempo real`);
        return response.data;
        
    } catch (error) {
        console.error(`❌ Erro ao buscar mensagens:`, error.response?.data || error.message);
        
        serverHealth.discordConnected = false;
        serverHealth.errorCount++;
        lastError = {
            message: error.message,
            timestamp: new Date().toISOString(),
            status: error.response?.status || 'NETWORK_ERROR'
        };
        
        return [];
    }
}

// PROCESSAMENTO ULTRA RÁPIDO - APENAS DADOS FRESCOS
function processMessages(messages) {
    const processedData = [];
    const now = Date.now();
    
    console.log(`⚡ Processamento rápido de ${messages.length} mensagens...`);
    
    messages.forEach((message, index) => {
        const messageAge = now - new Date(message.timestamp).getTime();
        
        // Skip mensagens antigas - APENAS FRESCAS
        if (messageAge > MAX_AGE) {
            return;
        }
        
        // Construir conteúdo completo rapidamente
        let fullContent = message.content || '';
        
        // Processar embeds
        if (message.embeds && message.embeds.length > 0) {
            message.embeds.forEach(embed => {
                if (embed.title) fullContent += embed.title + '\n';
                if (embed.description) fullContent += embed.description + '\n';
                if (embed.fields) {
                    embed.fields.forEach(field => {
                        fullContent += `${field.name}: ${field.value}\n`;
                    });
                }
            });
        }
        
        // Busca rápida de Job IDs
        const foundJobIds = new Set();
        let platform = 'Unknown';
        
        for (const pattern of JOB_ID_PATTERNS) {
            const matches = [...fullContent.matchAll(pattern)];
            
            for (const match of matches) {
                const potentialJobId = match[1];
                
                if (potentialJobId && /^[a-zA-Z0-9]{8,12}$/.test(potentialJobId)) {
                    // Filtro rápido de falsos positivos
                    const lowerJobId = potentialJobId.toLowerCase();
                    if (!lowerJobId.includes('javascript') && 
                        !lowerJobId.includes('undefined') && 
                        !lowerJobId.includes('function')) {
                        
                        foundJobIds.add(potentialJobId);
                        
                        // Detectar plataforma rapidamente
                        if (/mobile|android|ios/i.test(fullContent)) {
                            platform = 'Mobile';
                        } else if (/pc|desktop/i.test(fullContent)) {
                            platform = 'PC';
                        }
                        
                        // Sair no primeiro match para velocidade
                        if (foundJobIds.size >= 3) break;
                    }
                }
            }
            
            // Sair se já encontrou Job IDs
            if (foundJobIds.size > 0) break;
        }
        
        if (foundJobIds.size > 0) {
            const processedEntry = {
                id: message.id,
                timestamp: message.timestamp,
                processed_at: new Date().toISOString(),
                age_seconds: Math.floor(messageAge / 1000),
                job_ids: Array.from(foundJobIds),
                platform: platform,
                author: message.author.username,
                author_id: message.author.id,
                content_preview: fullContent.substring(0, 100),
                freshness_score: Math.max(0, 100 - (messageAge / 60000)),
                detection_method: 'real-time'
            };
            
            processedData.push(processedEntry);
            console.log(`✅ ${foundJobIds.size} Job ID(s): [${Array.from(foundJobIds).join(', ')}] - ${Math.floor(messageAge/1000)}s atrás`);
        }
    });
    
    // Ordenar apenas por freshness (mais fresco primeiro)
    const sorted = processedData.sort((a, b) => b.freshness_score - a.freshness_score);
    
    console.log(`🚀 ${sorted.length} entradas FRESCAS processadas em tempo real`);
    return sorted;
}

// ENDPOINT PRINCIPAL - SEMPRE DADOS FRESCOS
app.get('/pets', async (req, res) => {
    totalRequests++;
    const startTime = Date.now();
    
    // Headers para dados em tempo real
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Timestamp': startTime,
        'X-Fresh-Data': 'true',
        'X-Server-Health': serverHealth.status
    });
    
    try {
        console.log('⚡ Buscando dados FRESCOS em tempo real...');
        
        const messages = await fetchDiscordMessages();
        
        if (messages.length === 0) {
            return res.status(503).json({
                error: 'Discord API unavailable',
                timestamp: startTime,
                last_error: lastError,
                processing_time: Date.now() - startTime
            });
        }
        
        const processedData = processMessages(messages);
        const processingTime = Date.now() - startTime;
        
        successRequests++;
        serverHealth.status = 'healthy';
        
        console.log(`🚀 ${processedData.length} entradas FRESCAS retornadas em ${processingTime}ms`);
        
        res.json({
            data: processedData,
            total_entries: processedData.length,
            freshest_age_seconds: processedData[0] ? processedData[0].age_seconds : 0,
            timestamp: startTime,
            processing_time: processingTime,
            freshness: 'real-time',
            max_age_allowed: MAX_AGE / 1000
        });
        
    } catch (error) {
        console.error('❌ Erro no endpoint:', error);
        
        res.status(500).json({
            error: 'Internal server error',
            timestamp: startTime,
            processing_time: Date.now() - startTime,
            error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check simplificado
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
        mode: 'real-time',
        max_age_seconds: MAX_AGE / 1000,
        requests: {
            total: totalRequests,
            success: successRequests,
            success_rate: `${Math.round((successRequests / totalRequests) * 100) || 0}%`
        },
        last_error: lastError
    };
    
    res.json(healthStatus);
});

// Debug em tempo real
app.get('/debug', async (req, res) => {
    try {
        const startTime = Date.now();
        const messages = await fetchDiscordMessages();
        
        const detailedAnalysis = messages.slice(0, 3).map(msg => {
            const messageAge = Date.now() - new Date(msg.timestamp).getTime();
            
            let fullContent = msg.content || '';
            if (msg.embeds) {
                msg.embeds.forEach(embed => {
                    if (embed.title) fullContent += '\n' + embed.title;
                    if (embed.description) fullContent += '\n' + embed.description;
                });
            }
            
            return {
                message_id: msg.id,
                author: msg.author.username,
                timestamp: msg.timestamp,
                age_seconds: Math.floor(messageAge / 1000),
                is_fresh: messageAge <= MAX_AGE,
                content_length: fullContent.length,
                content_preview: fullContent.substring(0, 200)
            };
        });
        
        res.json({
            server_info: {
                version: 'Ghost AutoJoin v4.0 - Real Time',
                mode: 'no-cache',
                max_age_seconds: MAX_AGE / 1000,
                max_messages: MAX_MESSAGES,
                patterns_count: JOB_ID_PATTERNS.length
            },
            processing_time: Date.now() - startTime,
            total_messages: messages.length,
            fresh_messages: messages.filter(m => (Date.now() - new Date(m.timestamp).getTime()) <= MAX_AGE).length,
            detailed_analysis: detailedAnalysis,
            server_health: serverHealth
        });
        
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            mode: 'real-time-debug'
        });
    }
});

// Keep-alive simplificado
app.get('/keepalive', (req, res) => {
    res.json({
        status: 'alive',
        mode: 'real-time',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Middleware de erro
app.use((error, req, res, next) => {
    console.error('❌ Erro não tratado:', error);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        mode: 'real-time'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        available_endpoints: ['/pets', '/health', '/debug', '/keepalive']
    });
});

// Auto keep-alive otimizado
if (process.env.RENDER_SERVICE_NAME) {
    setInterval(async () => {
        try {
            await axios.get(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/keepalive`);
            console.log('🏓 Keep-alive ping');
        } catch (error) {
            console.log('⚠️ Keep-alive falhou');
        }
    }, 5 * 60 * 1000); // A cada 5 minutos
}

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Ghost AutoJoin Backend v4.0 - REAL TIME - Porta ${PORT}`);
    console.log(`⚡ MODO: SEM CACHE - DADOS SEMPRE FRESCOS`);
    console.log(`🎯 Endpoints:`);
    console.log(`   • GET  /pets     - Dados em tempo real`);
    console.log(`   • GET  /health   - Status do sistema`);
    console.log(`   • GET  /debug    - Debug em tempo real`);
    console.log(`   • GET  /keepalive - Keep-alive`);
    
    console.log(`⚡ Configurações RÁPIDAS:`);
    console.log(`   • Idade máxima: ${MAX_AGE/1000}s (APENAS DADOS FRESCOS)`);
    console.log(`   • Mensagens: ${MAX_MESSAGES}`);
    console.log(`   • Timeout: 5s`);
    console.log(`   • Padrões: ${JOB_ID_PATTERNS.length}`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('⚠️  CONFIGURE: DISCORD_TOKEN e CHANNEL_ID!');
        serverHealth.status = 'configuration_error';
    } else {
        console.log('✅ Configuração OK - Sistema REAL TIME operacional!');
        serverHealth.status = 'healthy';
    }
});
