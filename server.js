const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// ⚡ CONFIGURAÇÕES ULTRA-RÁPIDAS - ZERO CACHE
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));
app.use(express.json({ limit: '500kb' })); // Reduzido para max velocidade

// 🚫 ANTI-CACHE ABSOLUTO - DADOS SEMPRE FRESCOS
app.use((req, res, next) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Accel-Expires': '0',
        'Connection': 'close', // Força nova conexão
        'X-Fresh-Data': Date.now().toString()
    });
    next();
});

// CONFIGURAÇÕES
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// 📊 Métricas minimalistas
let metrics = { requests: 0, lastFetch: 0 };

// ⚡ Buscar mensagens - OTIMIZAÇÃO EXTREMA
async function fetchDiscordMessages() {
    const startTime = Date.now();
    
    try {
        // Força dados frescos com timestamp único
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages`,
            {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'X-Request-ID': Date.now().toString()
                },
                params: {
                    limit: 25, // Reduzido para max velocidade
                    _t: Date.now() // Anti-cache timestamp
                },
                timeout: 6000, // Timeout reduzido
                maxRedirects: 0 // Sem redirects
            }
        );
        
        const fetchTime = Date.now() - startTime;
        console.log(`⚡ ${response.data.length} msgs em ${fetchTime}ms`);
        metrics.lastFetch = fetchTime;

        return response.data;
    } catch (error) {
        console.error('❌ Erro fetch:', error.response?.status || error.message);
        return [];
    }
}

// 🔥 Processamento ULTRA-OTIMIZADO
function processMessages(messages) {
    const startTime = Date.now();
    const data = [];
    
    // Filtro apenas últimas 12 horas para max velocidade
    const cutoff = Date.now() - (12 * 60 * 60 * 1000);
    
    for (const msg of messages) {
        if (new Date(msg.timestamp).getTime() < cutoff) continue;
        
        // Processa embeds primeiro (mais comum)
        if (msg.embeds?.length > 0) {
            for (let i = 0; i < msg.embeds.length; i++) {
                const embed = msg.embeds[i];
                if (!embed.title?.includes('Brainrot Notify')) continue;
                
                let serverName = null, moneyPerSec = null, players = null;
                const jobIds = [];
                
                if (embed.fields?.length > 0) {
                    for (const field of embed.fields) {
                        const name = field.name.toLowerCase();
                        const value = field.value;
                        
                        if (name.includes('name') || name.includes('🏷️')) {
                            serverName = value.trim();
                        } else if (name.includes('money') || name.includes('💰')) {
                            moneyPerSec = value.replace(/\*/g, '').trim();
                        } else if (name.includes('players') || name.includes('👥')) {
                            players = value.replace(/\*/g, '').trim();
                        } else if (name.includes('job id')) {
                            let platform = 'PC';
                            if (name.includes('mobile')) platform = 'Mobile';
                            else if (name.includes('ios')) platform = 'iOS';
                            
                            jobIds.push({
                                id: value.trim(),
                                platform: platform
                            });
                        }
                    }
                }
                
                // Adiciona cada job ID como entrada separada
                for (const job of jobIds) {
                    data.push({
                        id: `${msg.id}_${i}_${job.platform}_${Date.now()}`, // ID único com timestamp
                        timestamp: msg.timestamp,
                        job_ids: [job.id],
                        platform: job.platform,
                        server_name: serverName,
                        money_per_sec: moneyPerSec,
                        players: players,
                        author: msg.author.username,
                        fresh: Date.now() // Marca de dados frescos
                    });
                }
            }
        }
        // Processa mensagens de texto
        else if (msg.content?.trim()) {
            const content = msg.content;
            const patterns = [
                /Job ID \((Mobile|iOS|PC)\)[:\s]*\n([a-zA-Z0-9]+)/i,
                /Job[:\s]*ID[:\s]*([a-zA-Z0-9]+)/i
            ];
            
            for (const pattern of patterns) {
                const match = content.match(pattern);
                if (match) {
                    let platform = match[1] || 'Unknown';
                    let jobId = match[2] || match[1];
                    
                    // Extrai outros dados
                    const nameMatch = content.match(/Name[:\s]*\n(.+)/i);
                    const moneyMatch = content.match(/Money per sec[:\s]*\n(.+)/i);
                    const playersMatch = content.match(/Players[:\s]*\n(\d+\/\d+)/i);
                    
                    data.push({
                        id: `${msg.id}_${Date.now()}`,
                        timestamp: msg.timestamp,
                        job_ids: [jobId],
                        platform: platform,
                        server_name: nameMatch?.[1]?.trim() || null,
                        money_per_sec: moneyMatch?.[1]?.trim() || null,
                        players: playersMatch?.[1]?.trim() || null,
                        author: msg.author.username,
                        fresh: Date.now()
                    });
                    break;
                }
            }
        }
    }
    
    // Ordena por timestamp mais recente
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const processTime = Date.now() - startTime;
    console.log(`🚀 ${data.length} entries em ${processTime}ms`);
    
    return data;
}

// 🎯 ENDPOINT PRINCIPAL - VELOCIDADE MÁXIMA
app.get('/pets', async (req, res) => {
    const start = Date.now();
    metrics.requests++;
    
    try {
        // Headers para garantir dados frescos
        res.set({
            'Content-Type': 'application/json; charset=utf-8',
            'X-Fetch-Time': Date.now().toString(),
            'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        const messages = await fetchDiscordMessages();
        const data = processMessages(messages);
        
        const responseTime = Date.now() - start;
        
        console.log(`⚡ Response: ${responseTime}ms | ${data.length} entries`);
        
        // Resposta com dados frescos
        res.json({
            data: data,
            meta: {
                count: data.length,
                response_time_ms: responseTime,
                fetched_at: Date.now(),
                fresh: true
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.status(500).json({ 
            error: 'Server error',
            timestamp: Date.now(),
            fresh: false
        });
    }
});

// 📊 Métricas rápidas
app.get('/metrics', (req, res) => {
    res.json({
        requests: metrics.requests,
        last_fetch_ms: metrics.lastFetch,
        uptime: Math.floor(process.uptime()),
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: Date.now(),
        fresh: true
    });
});

// ⚡ Teste ultra-rápido
app.get('/test', (req, res) => {
    res.json({ 
        status: '⚡ ULTRA-FAST API',
        timestamp: Date.now(),
        requests: metrics.requests,
        config_ok: !!(DISCORD_TOKEN && CHANNEL_ID),
        fresh: true
    });
});

// 🔥 Status mínimo
app.get('/status', (req, res) => {
    res.json({
        status: 'ONLINE',
        uptime: Math.floor(process.uptime()),
        requests: metrics.requests,
        fresh: Date.now()
    });
});

// 💚 Health check
app.get('/health', (req, res) => {
    res.json({ ok: true, t: Date.now() });
});

// 🚀 INICIALIZAÇÃO
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ULTRA-FAST API: ${PORT}`);
    console.log(`⚡ Endpoints disponíveis:`);
    console.log(`   GET /pets - Dados principais`);
    console.log(`   GET /test - Teste rápido`);
    console.log(`   GET /status - Status`);
    console.log(`   GET /metrics - Métricas`);
    console.log(`   GET /health - Health`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('⚠️  Configure DISCORD_TOKEN e CHANNEL_ID!');
    } else {
        console.log('✅ Configuração OK - DADOS SEMPRE FRESCOS!');
    }
});

// Shutdown handlers
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
