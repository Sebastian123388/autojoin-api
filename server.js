const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Variáveis de ambiente obrigatórias
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PLACE_ID = process.env.PLACE_ID;

// Validação das variáveis obrigatórias
if (!DISCORD_BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN não encontrado nas variáveis de ambiente');
    process.exit(1);
}

if (!DISCORD_CHANNEL_ID) {
    console.error('❌ DISCORD_CHANNEL_ID não encontrado nas variáveis de ambiente');
    process.exit(1);
}

if (!PLACE_ID) {
    console.error('❌ PLACE_ID não encontrado nas variáveis de ambiente');
    process.exit(1);
}

console.log('✅ Variáveis de ambiente carregadas:');
console.log(`📡 Canal: ${DISCORD_CHANNEL_ID}`);
console.log(`🏷️  Place ID: ${PLACE_ID}`);

// ZERO CACHE CONFIG - DADOS ULTRA FRESCOS EM TEMPO REAL
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '1mb' }));
app.set('x-powered-by', false);

// ZERO CACHE SYSTEM - Só dados em tempo real
const liveJobIds = []; // Array simples para JobIds ativos
const MAX_LIVE_IDS = 100; // Buffer pequeno para ultra velocidade
const ULTRA_FRESH_WINDOW = 15000; // 15 segundos = ULTRA FRESCO

// Bot Discord configurado para velocidade máxima
const client = new Client({
    intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [],
    presence: { status: 'invisible' },
    ws: { compress: false, large_threshold: 50 }
});

// Stats em tempo real (zero persistência)
let liveStats = {
    processed: 0,
    fresh: 0,
    lastJobId: null,
    lastUpdate: 0,
    responseCount: 0,
    channelId: DISCORD_CHANNEL_ID,
    placeId: PLACE_ID
};

// Regex ultra otimizada (pré-compilada)
const ULTRA_FAST_REGEX = /[a-zA-Z0-9\/\+]{45,70}/g;
const FIELD_EXTRACT_REGEX = /(?:server|job|id).*?[:=]\s*([a-zA-Z0-9\/\+]{45,70})/gi;

// Extração ZERO CACHE - Máxima velocidade
function instantExtractJobIds(text) {
    if (!text) return [];
    
    const ids = new Set();
    let match;
    
    // Reset regex para reutilização
    ULTRA_FAST_REGEX.lastIndex = 0;
    FIELD_EXTRACT_REGEX.lastIndex = 0;
    
    // Extração direta
    while ((match = ULTRA_FAST_REGEX.exec(text)) !== null) {
        if (match[0].length >= 45) ids.add(match[0]);
    }
    
    // Extração de campos específicos
    while ((match = FIELD_EXTRACT_REGEX.exec(text)) !== null) {
        if (match[1] && match[1].length >= 45) ids.add(match[1]);
    }
    
    return [...ids];
}

// Processamento INSTANTÂNEO de embeds
function instantProcessEmbeds(embeds) {
    let allText = '';
    let directIds = [];
    
    // Processamento ultra direto
    for (const embed of embeds) {
        if (embed.description) allText += embed.description + '\n';
        if (embed.fields) {
            for (const field of embed.fields) {
                allText += field.value + '\n';
                // Extração direta dos campos importantes
                if (field.name.toLowerCase().includes('server') || 
                    field.name.toLowerCase().includes('job')) {
                    directIds.push(...instantExtractJobIds(field.value));
                }
            }
        }
    }
    
    // Combina extração direta + texto completo
    const textIds = instantExtractJobIds(allText);
    return [...new Set([...directIds, ...textIds])];
}

// ZERO CACHE - Limpa dados antigos instantaneamente
function instantClean() {
    const now = Date.now();
    for (let i = liveJobIds.length - 1; i >= 0; i--) {
        if (now - liveJobIds[i].timestamp > ULTRA_FRESH_WINDOW) {
            liveJobIds.splice(i, 1);
        }
    }
    
    // Limita tamanho para velocidade máxima
    if (liveJobIds.length > MAX_LIVE_IDS) {
        liveJobIds.splice(0, liveJobIds.length - MAX_LIVE_IDS);
    }
}

// Event listener ZERO CACHE - Processamento instantâneo
client.on('messageCreate', message => {
    // FILTRO POR CANAL - Só monitora o canal específico
    if (message.channel.id !== DISCORD_CHANNEL_ID) return;
    
    // Filtros ultra rápidos
    if (!message.author.bot) return;
    
    const username = message.author.username.toLowerCase();
    const isBrainrot = username.includes('brainrot') || username.includes('notify') || username.includes('mirror');
    if (!isBrainrot) return;
    
    // Processamento INSTANTÂNEO (não assíncrono)
    try {
        let jobIds = [];
        
        // Prioriza embeds
        if (message.embeds?.length > 0) {
            jobIds = instantProcessEmbeds(message.embeds);
        } else if (message.content) {
            jobIds = instantExtractJobIds(message.content);
        }
        
        if (jobIds.length === 0) return;
        
        const now = Date.now();
        let newCount = 0;
        
        // Adiciona INSTANTANEAMENTE ao buffer ativo
        for (const jobId of jobIds) {
            // Verifica se já existe (busca ultra rápida)
            const exists = liveJobIds.some(item => item.jobId === jobId);
            if (!exists) {
                liveJobIds.push({
                    jobId,
                    timestamp: now,
                    source: username,
                    fresh: true,
                    channelId: DISCORD_CHANNEL_ID,
                    placeId: PLACE_ID
                });
                newCount++;
            }
        }
        
        if (newCount > 0) {
            liveStats.processed++;
            liveStats.fresh += newCount;
            liveStats.lastJobId = jobIds[0];
            liveStats.lastUpdate = now;
            
            // Limpeza instantânea após adição
            instantClean();
            
            console.log(`⚡ INSTANT: ${newCount} fresh JobIds | Total: ${liveJobIds.length} | Canal: ${DISCORD_CHANNEL_ID}`);
            
            // Reação sem await
            message.react('🎯').catch(() => {});
        }
        
    } catch (error) {
        console.error('E:', error.message);
    }
});

// Eventos mínimos
client.on('ready', () => {
    console.log(`✅ ${client.user.tag} - ZERO CACHE MODE`);
    console.log(`📡 Monitorando canal: ${DISCORD_CHANNEL_ID}`);
    console.log(`🏷️  Place ID: ${PLACE_ID}`);
});
client.on('error', () => {});

// ENDPOINT ZERO CACHE - ULTRA VELOCIDADE
app.get('/pets/fresh', (req, res) => {
    // Headers para ZERO cache
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    
    const now = Date.now();
    liveStats.responseCount++;
    
    // Limpeza instantânea antes da resposta
    instantClean();
    
    // Filtra apenas JobIds ULTRA FRESCOS (últimos 15 segundos)
    const ultraFreshJobs = liveJobIds
        .filter(job => now - job.timestamp < ULTRA_FRESH_WINDOW)
        .map(job => ({
            jobId: job.jobId,
            timestamp: job.timestamp,
            source: job.source,
            age: Math.floor((now - job.timestamp) / 1000),
            channelId: job.channelId,
            placeId: job.placeId
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // Mais recente primeiro
    
    console.log(`📡 INSTANT RESPONSE: ${ultraFreshJobs.length} ultra fresh jobs`);
    
    res.json({
        success: true,
        count: ultraFreshJobs.length,
        jobIds: ultraFreshJobs,
        timestamp: now,
        mode: 'ZERO_CACHE',
        freshWindow: ULTRA_FRESH_WINDOW,
        channelId: DISCORD_CHANNEL_ID,
        placeId: PLACE_ID
    });
});

// Status em tempo real
app.get('/bot/status', (req, res) => {
    const now = Date.now();
    instantClean(); // Limpeza instantânea
    
    res.json({
        ...liveStats,
        liveJobIds: liveJobIds.length,
        ultraFreshCount: liveJobIds.filter(job => now - job.timestamp < ULTRA_FRESH_WINDOW).length,
        connected: client.isReady(),
        mode: 'ZERO_CACHE',
        freshWindow: ULTRA_FRESH_WINDOW,
        maxBuffer: MAX_LIVE_IDS,
        config: {
            channelId: DISCORD_CHANNEL_ID,
            placeId: PLACE_ID,
            botToken: DISCORD_BOT_TOKEN ? '***CONFIGURADO***' : '❌ AUSENTE'
        }
    });
});

// Teste instantâneo
app.post('/bot/test', (req, res) => {
    const { text } = req.body;
    const jobIds = instantExtractJobIds(text || '');
    
    const now = Date.now();
    let added = 0;
    
    for (const jobId of jobIds) {
        const exists = liveJobIds.some(item => item.jobId === jobId);
        if (!exists) {
            liveJobIds.push({
                jobId,
                timestamp: now,
                source: 'TEST',
                fresh: true,
                channelId: DISCORD_CHANNEL_ID,
                placeId: PLACE_ID
            });
            added++;
        }
    }
    
    instantClean();
    
    res.json({
        success: true,
        found: jobIds.length,
        added: added,
        jobIds,
        total: liveJobIds.length,
        channelId: DISCORD_CHANNEL_ID,
        placeId: PLACE_ID
    });
});

// Root
app.get('/', (req, res) => {
    res.json({
        status: 'ZERO CACHE MODE',
        mode: 'ULTRA_FRESH_REAL_TIME',
        freshWindow: ULTRA_FRESH_WINDOW + 'ms',
        liveJobs: liveJobIds.length,
        processed: liveStats.processed,
        responses: liveStats.responseCount,
        config: {
            channelId: DISCORD_CHANNEL_ID,
            placeId: PLACE_ID,
            monitoring: 'CANAL ESPECÍFICO'
        }
    });
});

// Limpeza automática ULTRA FREQUENTE (apenas quando necessário)
setInterval(() => {
    // Só limpa se há dados para limpar
    if (liveJobIds.length > 0) {
        const before = liveJobIds.length;
        instantClean();
        const after = liveJobIds.length;
        if (before !== after) {
            console.log(`🧹 Auto clean: ${before} → ${after} jobs`);
        }
    }
}, 3000); // A cada 3 segundos

// Keep-alive minimalista
const keepAliveUrl = `https://autojoin-api.onrender.com`;
function ultraKeepAlive() {
    require('https').get(keepAliveUrl, () => {}).on('error', () => {});
    setTimeout(ultraKeepAlive, 12 * 60 * 1000); // 12 minutos
}

// Inicialização ZERO CACHE
async function zeroStart() {
    try {
        await client.login(DISCORD_BOT_TOKEN);
        console.log('🤖 Bot ONLINE - ZERO CACHE MODE');
        
        app.listen(PORT, () => {
            console.log(`🚀 ZERO CACHE SERVER: ${PORT}`);
            console.log(`⚡ Mode: REAL TIME - NO CACHE`);
            console.log(`🔥 Fresh Window: ${ULTRA_FRESH_WINDOW}ms`);
            console.log(`📡 Fresh Endpoint: /pets/fresh`);
            console.log(`💨 Max Buffer: ${MAX_LIVE_IDS} JobIds`);
            console.log(`📋 Configuração:`);
            console.log(`   📡 Canal: ${DISCORD_CHANNEL_ID}`);
            console.log(`   🏷️  Place: ${PLACE_ID}`);
            
            // Inicia keep-alive
            ultraKeepAlive();
        });
        
    } catch (error) {
        console.error('❌ Zero start error:', error);
        console.error('🔧 Verifique as variáveis de ambiente:');
        console.error(`   - DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN ? 'OK' : 'AUSENTE'}`);
        console.error(`   - DISCORD_CHANNEL_ID: ${DISCORD_CHANNEL_ID || 'AUSENTE'}`);
        console.error(`   - PLACE_ID: ${PLACE_ID || 'AUSENTE'}`);
        process.exit(1);
    }
}

// Cleanup
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

// 🚀 START ZERO CACHE MODE
zeroStart();
