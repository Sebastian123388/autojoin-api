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
app.use(express.json({ limit: '500kb' }));

// 🚫 ANTI-CACHE ABSOLUTO - DADOS SEMPRE FRESCOS
app.use((req, res, next) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Accel-Expires': '0',
        'Connection': 'close',
        'X-Fresh-Data': Date.now().toString(),
        'Access-Control-Allow-Origin': '*'
    });
    next();
});

// CONFIGURAÇÕES
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// 📊 Métricas otimizadas
let metrics = { 
    requests: 0, 
    lastFetch: 0, 
    serversFound: 0,
    errors: 0,
    uptime: Date.now()
};

// ⚡ Buscar mensagens do Discord - OTIMIZAÇÃO EXTREMA
async function fetchDiscordMessages() {
    const startTime = Date.now();
    
    try {
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
                    limit: 30, // Aumentado para pegar mais servidores
                    _t: Date.now()
                },
                timeout: 5000,
                maxRedirects: 0
            }
        );
        
        const fetchTime = Date.now() - startTime;
        console.log(`⚡ Discord: ${response.data.length} msgs em ${fetchTime}ms`);
        metrics.lastFetch = fetchTime;

        return response.data;
    } catch (error) {
        console.error('❌ Discord Error:', error.response?.status || error.message);
        metrics.errors++;
        return [];
    }
}

// 🔥 Processamento ULTRA-OTIMIZADO - BRAINROT NOTIFY
function processMessages(messages) {
    const startTime = Date.now();
    const data = [];
    
    // Filtro apenas últimas 6 horas para max velocidade
    const cutoff = Date.now() - (6 * 60 * 60 * 1000);
    
    console.log(`🔍 Processando ${messages.length} mensagens...`);
    
    for (const msg of messages) {
        if (new Date(msg.timestamp).getTime() < cutoff) continue;
        
        // Processa embeds - FORMATO BRAINROT NOTIFY | CHILLI HUB
        if (msg.embeds?.length > 0) {
            for (let i = 0; i < msg.embeds.length; i++) {
                const embed = msg.embeds[i];
                
                // Busca pelo título específico
                if (!embed.title?.includes('Brainrot Notify') || !embed.title?.includes('Chilli Hub')) continue;
                
                let serverName = null, moneyPerSec = null, players = null;
                let mobileJobId = null, iosJobId = null, pcJobId = null;
                
                if (embed.fields?.length > 0) {
                    for (const field of embed.fields) {
                        const name = field.name;
                        const value = field.value.trim();
                        
                        // Identificação precisa dos campos
                        if (name.includes('Name') && name.includes('🏷️')) {
                            serverName = value;
                        }
                        else if (name.includes('Money per sec') && name.includes('💰')) {
                            moneyPerSec = value;
                        }
                        else if (name.includes('Players') && name.includes('👥')) {
                            players = value;
                        }
                        else if (name === 'Job ID (Mobile)' || name.includes('📱')) {
                            mobileJobId = value;
                        }
                        else if (name === 'Job ID (iOS)' || name.includes('🍎')) {
                            iosJobId = value;
                        }
                        else if (name === 'Job ID (PC)' || name.includes('💻')) {
                            pcJobId = value;
                        }
                    }
                }
                
                // Cria entrada para cada Job ID válido
                let entriesCreated = 0;
                
                if (mobileJobId && mobileJobId.length > 10) {
                    data.push({
                        id: `${msg.id}_${i}_mobile_${Date.now()}`,
                        timestamp: msg.timestamp,
                        job_ids: [mobileJobId],
                        platform: 'Mobile',
                        server_name: serverName,
                        money_per_sec: moneyPerSec,
                        players: players,
                        author: msg.author.username,
                        embed_title: embed.title,
                        fresh: Date.now()
                    });
                    entriesCreated++;
                }
                
                if (iosJobId && iosJobId.length > 10) {
                    data.push({
                        id: `${msg.id}_${i}_ios_${Date.now()}`,
                        timestamp: msg.timestamp,
                        job_ids: [iosJobId],
                        platform: 'iOS',
                        server_name: serverName,
                        money_per_sec: moneyPerSec,
                        players: players,
                        author: msg.author.username,
                        embed_title: embed.title,
                        fresh: Date.now()
                    });
                    entriesCreated++;
                }
                
                if (pcJobId && pcJobId.length > 10) {
                    data.push({
                        id: `${msg.id}_${i}_pc_${Date.now()}`,
                        timestamp: msg.timestamp,
                        job_ids: [pcJobId],
                        platform: 'PC',
                        server_name: serverName,
                        money_per_sec: moneyPerSec,
                        players: players,
                        author: msg.author.username,
                        embed_title: embed.title,
                        fresh: Date.now()
                    });
                    entriesCreated++;
                }
                
                if (entriesCreated > 0) {
                    console.log(`🎯 ${entriesCreated} servidores de "${serverName}" (${players})`);
                }
            }
        }
        // Processa mensagens de texto simples (fallback)
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
                    
                    if (jobId && jobId.length > 10) {
                        const nameMatch = content.match(/Name[:\s]*\n(.+)/i);
                        const moneyMatch = content.match(/Money per sec[:\s]*\n(.+)/i);
                        const playersMatch = content.match(/Players[:\s]*\n(\d+\/\d+)/i);
                        
                        data.push({
                            id: `${msg.id}_text_${Date.now()}`,
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
    }
    
    // Ordena por timestamp mais recente primeiro
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const processTime = Date.now() - startTime;
    metrics.serversFound = data.length;
    console.log(`🚀 ${data.length} servidores processados em ${processTime}ms`);
    
    return data;
}

// 🎯 ENDPOINT PRINCIPAL - /pets (para compatibilidade com o script Lua)
app.get('/pets', async (req, res) => {
    const start = Date.now();
    metrics.requests++;
    
    try {
        // Headers para dados ultra-frescos
        res.set({
            'Content-Type': 'application/json; charset=utf-8',
            'X-Fetch-Time': Date.now().toString(),
            'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            'X-Server-Count': '0' // Será atualizado abaixo
        });
        
        const messages = await fetchDiscordMessages();
        const servers = processMessages(messages);
        
        const responseTime = Date.now() - start;
        
        // Atualiza header com contagem de servidores
        res.set('X-Server-Count', servers.length.toString());
        
        console.log(`⚡ API Response: ${responseTime}ms | ${servers.length} servidores`);
        
        // Resposta no formato exato que o script Lua espera
        res.json(servers);
        
    } catch (error) {
        console.error('❌ API Error:', error.message);
        metrics.errors++;
        res.status(500).json({ 
            error: 'Internal server error',
            timestamp: Date.now(),
            fresh: false
        });
    }
});

// 🎯 Endpoint para Debug - simula processamento do Lua
app.get('/debug', async (req, res) => {
    try {
        const messages = await fetchDiscordMessages();
        const data = processMessages(messages);
        
        // Simula exatamente como o script Lua processa
        const luaSimulation = {
            totalServers: data.length,
            serversByPlatform: {
                PC: data.filter(s => s.platform === 'PC').length,
                Mobile: data.filter(s => s.platform === 'Mobile').length,
                iOS: data.filter(s => s.platform === 'iOS').length
            },
            recentServers: data.slice(0, 5).map((server, index) => ({
                index: index,
                hasJobIds: !!(server.job_ids && server.job_ids.length > 0),
                firstJobId: server.job_ids ? server.job_ids[0].substring(0, 12) + '...' : null,
                platform: server.platform,
                server: server.server_name,
                players: server.players,
                timestamp: server.timestamp
            })),
            rawDataSample: data.slice(0, 3) // Apenas primeiros 3 para debug
        };
        
        res.json(luaSimulation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📊 Métricas detalhadas
app.get('/metrics', (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - metrics.uptime) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    
    res.json({
        requests: metrics.requests,
        servers_found: metrics.serversFound,
        errors: metrics.errors,
        last_fetch_ms: metrics.lastFetch,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        uptime_seconds: uptimeSeconds,
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: Date.now(),
        fresh: true,
        config: {
            discord_token: !!DISCORD_TOKEN,
            channel_id: !!CHANNEL_ID,
            node_env: process.env.NODE_ENV || 'development'
        }
    });
});

// ⚡ Teste ultra-rápido
app.get('/test', (req, res) => {
    res.json({ 
        status: '⚡ AutoJoin Ultra API',
        version: '2.0.0',
        timestamp: Date.now(),
        requests: metrics.requests,
        servers_found: metrics.serversFound,
        config_ok: !!(DISCORD_TOKEN && CHANNEL_ID),
        endpoints: [
            'GET /pets - Dados para AutoJoin',
            'GET /debug - Debug do processamento',
            'GET /metrics - Estatísticas detalhadas',
            'GET /test - Este endpoint',
            'GET /status - Status resumido',
            'GET /health - Health check'
        ],
        fresh: true
    });
});

// 🔥 Status resumido
app.get('/status', (req, res) => {
    res.json({
        status: '🚀 ONLINE',
        uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
        requests: metrics.requests,
        servers: metrics.serversFound,
        errors: metrics.errors,
        last_check: metrics.lastFetch,
        fresh: Date.now()
    });
});

// 💚 Health check para render.com
app.get('/health', (req, res) => {
    res.json({ 
        ok: true, 
        timestamp: Date.now(),
        service: 'autojoin-ultra-api'
    });
});

// 🌐 Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: '⚡ AutoJoin Ultra API',
        version: '2.0.0',
        description: 'Ultra-fast Discord message processor for Roblox AutoJoin',
        endpoints: {
            '/pets': 'Main endpoint for AutoJoin script',
            '/debug': 'Debug information',
            '/metrics': 'Detailed metrics',
            '/test': 'Quick test',
            '/status': 'Status summary',
            '/health': 'Health check'
        },
        github: 'https://github.com/your-repo',
        timestamp: Date.now()
    });
});

// 🚀 INICIALIZAÇÃO
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 AutoJoin Ultra API v2.0`);
    console.log(`⚡ Rodando na porta: ${PORT}`);
    console.log(`🌐 Endpoints disponíveis:`);
    console.log(`   📡 GET /pets - Dados para AutoJoin Lua`);
    console.log(`   🐛 GET /debug - Debug do processamento`);
    console.log(`   📊 GET /metrics - Métricas detalhadas`);
    console.log(`   ⚡ GET /test - Teste rápido`);
    console.log(`   📈 GET /status - Status resumido`);
    console.log(`   💚 GET /health - Health check`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.log(`\n⚠️  ATENÇÃO: Configure as variáveis de ambiente!`);
        console.log(`   DISCORD_TOKEN=${DISCORD_TOKEN ? '✅' : '❌'}`);
        console.log(`   CHANNEL_ID=${CHANNEL_ID ? '✅' : '❌'}`);
    } else {
        console.log(`\n✅ Configuração completa!`);
        console.log(`🎯 Monitorando canal: ${CHANNEL_ID}`);
        console.log(`🔥 DADOS SEMPRE FRESCOS - ZERO CACHE`);
    }
    
    console.log(`\n🚀 Sistema pronto para AutoJoin Ultra!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 Recebido SIGTERM, desligando graciosamente...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Recebido SIGINT, desligando graciosamente...');
    process.exit(0);
});

// Error handling global
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    metrics.errors++;
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
    metrics.errors++;
});
