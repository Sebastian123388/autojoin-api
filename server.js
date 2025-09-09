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

// 🚀 CACHE ULTRA-RÁPIDO (reduzido para 5 segundos)
let cachedData = [];
let lastFetch = 0;
const CACHE_TIME = 5000; // 5 segundos - muito mais rápido
let isFetching = false; // Previne múltiplas requisições simultâneas

// 📊 Sistema de métricas para monitorar performance
let metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    lastRequestTime: 0
};

// ⚡ Buscar mensagens do Discord - OTIMIZADO
async function fetchDiscordMessages() {
    if (isFetching) {
        console.log('⏳ Já buscando mensagens, aguardando...');
        return cachedData;
    }

    try {
        isFetching = true;
        console.log('🔍 Buscando mensagens do Discord...');
        
        const startTime = Date.now();
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=30`, // Reduzido para 30 - mais rápido
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
    } finally {
        isFetching = false;
    }
}

// 🔥 Processar mensagens - SUPER OTIMIZADO
function processMessages(messages) {
    const startTime = Date.now();
    const processedData = [];
    
    // Processa apenas mensagens recentes (últimas 24h para performance)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentMessages = messages.filter(msg => 
        new Date(msg.timestamp).getTime() > oneDayAgo
    );
    
    recentMessages.forEach(message => {
        // Processa embeds (formato principal)
        if (message.embeds && message.embeds.length > 0) {
            message.embeds.forEach((embed, embedIndex) => {
                // Verifica se é Brainrot Notify
                if (embed.title && embed.title.includes('Brainrot Notify')) {
                    let serverName = null;
                    let moneyPerSec = null;
                    let players = null;
                    let jobIds = [];
                    
                    // Processa campos rapidamente
                    if (embed.fields && embed.fields.length > 0) {
                        embed.fields.forEach(field => {
                            const fieldName = field.name.toLowerCase();
                            const fieldValue = field.value;
                            
                            // Extração otimizada
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
                    
                    // Cria entradas rapidamente
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
        }
        // Fallback para content (mantido, mas otimizado)
        else if (message.content && message.content.trim().length > 0) {
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
    
    // Ordenação otimizada
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
        const now = Date.now();
        
        // Cache hit - resposta instantânea
        if (now - lastFetch < CACHE_TIME && cachedData.length > 0) {
            metrics.cacheHits++;
            const responseTime = Date.now() - requestStart;
            metrics.lastRequestTime = responseTime;
            
            // Headers para performance máxima
            res.set({
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Response-Time': `${responseTime}ms`,
                'X-Cache': 'HIT',
                'X-Data-Age': `${now - lastFetch}ms`
            });
            
            return res.json(cachedData);
        }
        
        // Cache miss - buscar dados
        metrics.cacheMisses++;
        
        const messages = await fetchDiscordMessages();
        const processedData = processMessages(messages);
        
        // Atualizar cache
        cachedData = processedData;
        lastFetch = now;
        
        const responseTime = Date.now() - requestStart;
        metrics.lastRequestTime = responseTime;
        metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
        
        res.set({
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Response-Time': `${responseTime}ms`,
            'X-Cache': 'MISS',
            'X-Entries': processedData.length.toString()
        });
        
        console.log(`🚀 Resposta enviada em ${responseTime}ms (${processedData.length} entradas)`);
        res.json(processedData);
        
    } catch (error) {
        console.error('❌ Erro no endpoint:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            timestamp: new Date().toISOString(),
            cached_fallback: cachedData.length > 0
        });
    }
});

// 📊 Endpoint de métricas (novo)
app.get('/metrics', (req, res) => {
    res.json({
        ...metrics,
        cache_size: cachedData.length,
        cache_age_ms: Date.now() - lastFetch,
        cache_fresh: (Date.now() - lastFetch) < CACHE_TIME,
        uptime_seconds: process.uptime(),
        memory_usage: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// ✅ Endpoint de teste - OTIMIZADO
app.get('/test', (req, res) => {
    res.json({ 
        status: '⚡ API Ultra-Rápida Online!', 
        timestamp: new Date().toISOString(),
        performance: {
            cache_time_ms: CACHE_TIME,
            cache_entries: cachedData.length,
            last_fetch: lastFetch ? new Date(lastFetch).toISOString() : null,
            response_time_ms: metrics.lastRequestTime,
            total_requests: metrics.totalRequests,
            cache_hit_rate: metrics.totalRequests > 0 ? 
                `${((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)}%` : '0%'
        },
        config: {
            hasToken: !!DISCORD_TOKEN,
            hasChannelId: !!CHANNEL_ID,
            node_env: process.env.NODE_ENV || 'development'
        }
    });
});

// 📈 Endpoint de status - MELHORADO
app.get('/status', (req, res) => {
    const now = Date.now();
    res.json({
        status: '🔥 ONLINE',
        uptime: Math.floor(process.uptime()),
        performance: {
            cached_entries: cachedData.length,
            cache_fresh: (now - lastFetch) < CACHE_TIME,
            last_fetch: lastFetch ? new Date(lastFetch).toISOString() : null,
            next_fetch: lastFetch ? new Date(lastFetch + CACHE_TIME).toISOString() : 'on-demand',
            avg_response_time_ms: Math.round(metrics.averageResponseTime),
            total_requests: metrics.totalRequests
        },
        sample: cachedData.slice(0, 1).map(entry => ({
            platform: entry.platform,
            server: entry.server_name,
            has_job_id: !!entry.job_ids && entry.job_ids.length > 0
        }))
    });
});

// 🔧 Endpoint de debug - OTIMIZADO
app.get('/debug', async (req, res) => {
    try {
        const messages = await fetchDiscordMessages();
        const sample = messages.slice(0, 3).map(msg => ({
            id: msg.id,
            author: msg.author.username,
            timestamp: msg.timestamp,
            has_content: !!msg.content && msg.content.length > 0,
            has_embeds: msg.embeds && msg.embeds.length > 0,
            embed_titles: msg.embeds ? msg.embeds.map(e => e.title).filter(Boolean) : [],
            first_embed_fields: msg.embeds && msg.embeds[0] && msg.embeds[0].fields ? 
                msg.embeds[0].fields.slice(0, 3).map(f => f.name) : []
        }));
        
        res.json({
            message: '🔍 Debug das últimas 3 mensagens (otimizado)',
            cache_info: {
                entries: cachedData.length,
                last_update: lastFetch ? new Date(lastFetch).toISOString() : null,
                is_fetching: isFetching
            },
            messages: sample
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 💀 Health check simples para Render.com
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// 🚀 INICIALIZAÇÃO OTIMIZADA
const PORT = process.env.PORT || 3000;

// Pre-warming do cache
async function preWarmCache() {
    if (DISCORD_TOKEN && CHANNEL_ID) {
        console.log('🔥 Pre-warming cache...');
        try {
            const messages = await fetchDiscordMessages();
            cachedData = processMessages(messages);
            lastFetch = Date.now();
            console.log(`✅ Cache pré-aquecido com ${cachedData.length} entradas`);
        } catch (error) {
            console.warn('⚠️  Falha no pre-warming, continuando...');
        }
    }
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Servidor ULTRA-RÁPIDO rodando na porta ${PORT}`);
    console.log(`⚡ Cache: ${CACHE_TIME}ms | Timeout: 8s | Mensagens: 30`);
    console.log(`🔗 Endpoints:`);
    console.log(`   • GET /pets - Dados principais (ULTRA-RÁPIDO)`);
    console.log(`   • GET /test - Teste + métricas`);
    console.log(`   • GET /status - Status do sistema`);
    console.log(`   • GET /metrics - Métricas detalhadas`);
    console.log(`   • GET /debug - Debug otimizado`);
    console.log(`   • GET /health - Health check`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('⚠️  Configure DISCORD_TOKEN e CHANNEL_ID!');
    } else {
        console.log('✅ Configuração OK!');
        await preWarmCache();
        console.log('🔥 Pronto para requisições ultra-rápidas!');
    }
});

// Keep-alive para Render.com (evita cold starts)
if (process.env.NODE_ENV === 'production') {
    setInterval(async () => {
        // Auto-refresh do cache em background
        if (Date.now() - lastFetch > CACHE_TIME && !isFetching) {
            try {
                const messages = await fetchDiscordMessages();
                cachedData = processMessages(messages);
                lastFetch = Date.now();
                console.log(`🔄 Cache auto-atualizado: ${cachedData.length} entradas`);
            } catch (error) {
                console.warn('⚠️  Auto-refresh falhou:', error.message);
            }
        }
    }, 15000); // A cada 15s
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, desligando graciosamente...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, desligando graciosamente...');
    process.exit(0);
});
