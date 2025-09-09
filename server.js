const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// ⚡ CONFIGURAÇÕES ULTRA-RÁPIDAS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));
app.use(express.json({ limit: '1mb' }));

// Desabilitar logs desnecessários em produção
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=5, max=1000'
        });
        next();
    });
}

// CONFIGURAÇÕES - ALTERE AQUI!
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// 📊 Sistema de métricas para monitorar performance
let metrics = {
    totalRequests: 0,
    averageResponseTime: 0,
};

// ⚡ Buscar mensagens do Discord - OTIMIZADO
async function fetchDiscordMessages() {
    console.log('🔍 Buscando mensagens do Discord...');
    
    try {
        const startTime = Date.now();
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=30`,
            {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 8000 // Timeout de 8s
            }
        );
        
        const fetchTime = Date.now() - startTime;
        console.log(`✅ ${response.data.length} mensagens em ${fetchTime}ms`);

        return response.data;
    } catch (error) {
        console.error('❌ Erro ao buscar mensagens:', error.response?.data || error.message);
        return [];
    }
}

// 🔥 Processar mensagens - SUPER OTIMIZADO
function processMessages(messages) {
    const startTime = Date.now();
    const processedData = [];
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentMessages = messages.filter(msg => 
        new Date(msg.timestamp).getTime() > oneDayAgo
    );

    recentMessages.forEach(message => {
        if (message.embeds && message.embeds.length > 0) {
            message.embeds.forEach((embed, embedIndex) => {
                if (embed.title && embed.title.includes('Brainrot Notify')) {
                    let serverName = null;
                    let moneyPerSec = null;
                    let players = null;
                    let jobIds = [];
                    
                    if (embed.fields && embed.fields.length > 0) {
                        embed.fields.forEach(field => {
                            const fieldName = field.name.toLowerCase();
                            const fieldValue = field.value;
                            
                            if (fieldName.includes('name') || fieldName.includes('🏷️')) {
                                serverName = fieldValue.trim();
                            }
                            else if (fieldName.includes('money') || fieldName.includes('💰')) {
                                moneyPerSec = fieldValue.replace(/\*/g, '').trim();
                            }
                            else if (fieldName.includes('players') || fieldName.includes('👥')) {
                                players = fieldValue.replace(/\*/g, '').trim();
                            }
                            else if (fieldName.includes('job id')) {
                                let platform = 'Unknown';
                                if (fieldName.includes('mobile')) platform = 'Mobile';
                                else if (fieldName.includes('ios')) platform = 'iOS';
                                else if (fieldName.includes('pc')) platform = 'PC';
                                
                                jobIds.push({
                                    id: fieldValue.trim(),
                                    platform: platform
                                });
                            }
                        });
                    }
                    
                    if (jobIds.length > 0) {
                        jobIds.forEach(jobId => {
                            processedData.push({
                                id: `${message.id}_${embedIndex}_${jobId.platform}`,
                                message_id: message.id,
                                timestamp: message.timestamp,
                                job_ids: [jobId.id],
                                platform: jobId.platform,
                                server_name: serverName,
                                money_per_sec: moneyPerSec,
                                players: players,
                                author: message.author.username,
                                embed_title: embed.title,
                                fresh: true
                            });
                        });
                    }
                }
            });
        } else if (message.content && message.content.trim().length > 0) {
            const jobIdPatterns = [
                /Job ID \(Mobile\)[:\s]*\n([a-zA-Z0-9]+)/i,
                /Job ID \(iOS\)[:\s]*\n([a-zA-Z0-9]+)/i,
                /Job ID \(PC\)[:\s]*\n([a-zA-Z0-9]+)/i,
                /Job[:\s]*ID[:\s]*([a-zA-Z0-9]+)/i
            ];
            
            let jobIdFound = null;
            let platform = 'Unknown';
            
            for (const pattern of jobIdPatterns) {
                const match = message.content.match(pattern);
                if (match) {
                    jobIdFound = match[1];
                    
                    if (message.content.includes('(Mobile)')) platform = 'Mobile';
                    else if (message.content.includes('(iOS)')) platform = 'iOS';
                    else if (message.content.includes('(PC)')) platform = 'PC';
                    break;
                }
            }
            
            if (jobIdFound) {
                const nameMatch = message.content.match(/Name[:\s]*\n(.+)/i);
                const moneyMatch = message.content.match(/Money per sec[:\s]*\n(.+)/i);
                const playersMatch = message.content.match(/Players[:\s]*\n(\d+\/\d+)/i);
                
                processedData.push({
                    id: message.id,
                    timestamp: message.timestamp,
                    job_ids: [jobIdFound],
                    platform: platform,
                    server_name: nameMatch ? nameMatch[1].trim() : null,
                    money_per_sec: moneyMatch ? moneyMatch[1].trim() : null,
                    players: playersMatch ? playersMatch[1].trim() : null,
                    author: message.author.username,
                    fresh: true
                });
            }
        }
    });
    
    const sorted = processedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const processTime = Date.now() - startTime;
    console.log(`🚀 ${sorted.length} entradas processadas em ${processTime}ms`);
    
    return sorted;
}

// 🎯 ENDPOINT PRINCIPAL - ULTRA OTIMIZADO
app.get('/pets', async (req, res) => {
    const requestStart = Date.now();
    metrics.totalRequests++;
    
    try {
        const messages = await fetchDiscordMessages();
        const processedData = processMessages(messages);
        
        const responseTime = Date.now() - requestStart;
        metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
        
        res.set({
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Response-Time': `${responseTime}ms`,
            'X-Entries': processedData.length.toString()
        });
        
        console.log(`🚀 Resposta enviada em ${responseTime}ms (${processedData.length} entradas)`);
        res.json(processedData);
        
    } catch (error) {
        console.error('❌ Erro no endpoint:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            timestamp: new Date().toISOString()
        });
    }
});

// 📊 Endpoint de métricas (novo)
app.get('/metrics', (req, res) => {
    res.json({
        ...metrics,
        uptime_seconds: process.uptime(),
        memory_usage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
    });
});

// ✅ Endpoint de teste - OTIMIZADO
app.get('/test', (req, res) => {
    res.json({ 
        status: '⚡ API Ultra-Rápida Online!', 
        timestamp: new Date().toISOString(),
        performance: {
            response_time_ms: metrics.averageResponseTime,
            total_requests: metrics.totalRequests,
        },
        config: {
            hasToken: !!DISCORD_TOKEN,
            hasChannelId: !!CHANNEL_ID,
            node_env: process.env.NODE_ENV || 'development',
        }
    });
});

// 📈 Endpoint de status - MELHORADO
app.get('/status', (req, res) => {
    res.json({
        status: '🔥 ONLINE',
        uptime: Math.floor(process.uptime()),
        performance: {
            total_requests: metrics.totalRequests,
        },
    });
});

// 💀 Health check simples para Render.com
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// 🚀 INICIALIZAÇÃO OTIMIZADA
const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Servidor ULTRA-RÁPIDO rodando na porta ${PORT}`);
    console.log(`🔗 Endpoints:`);
    console.log(`   • GET /pets - Dados principais (frescos)`);
    console.log(`   • GET /test - Teste + métricas`);
    console.log(`   • GET /status - Status do sistema`);
    console.log(`   • GET /metrics - Métricas detalhadas`);
    console.log(`   • GET /health - Health check`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('⚠️  Configure DISCORD_TOKEN e CHANNEL_ID!');
    } else {
        console.log('✅ Configuração OK!');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, desligando graciosamente...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, desligando graciosamente...');
    process.exit(0);
});
