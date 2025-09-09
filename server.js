const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURAÇÕES DE ULTRA VELOCIDADE
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '1mb' }));

// Desabilita logs desnecessários do Express
app.set('x-powered-by', false);

// Cache ultra rápido usando Map nativo (mais rápido que Object)
const jobCache = new Map();
const freshJobIds = new Map(); // Cache separado para JobIds ultra-frescos
const MAX_CACHE_SIZE = 500; // Reduzido para maior velocidade
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos (reduzido)
const ULTRA_FRESH_DURATION = 30 * 1000; // 30 segundos para ultra-fresco

// Bot Discord com configuração mínima para máxima velocidade
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [], // Removido partials desnecessários
    presence: { status: 'invisible' }, // Invisível para economizar recursos
    ws: {
        compress: false, // Desabilita compressão para velocidade
        large_threshold: 50 // Reduzido
    }
});

// Stats ultra-minimalistas
let stats = {
    total: 0,
    fresh: 0,
    processed: 0,
    startTime: Date.now(),
    lastJobId: null
};

// Regex pré-compilada para máxima velocidade
const JOB_ID_REGEX = /[a-zA-Z0-9\/\+]{45,70}/g;
const FIELD_REGEX = /(?:server|job|id).*?[:=]\s*([a-zA-Z0-9\/\+]{45,70})/gi;

// Função ultra-rápida de extração de JobIds
function fastExtractJobIds(text) {
    if (!text) return [];
    
    const ids = new Set();
    let match;
    
    // Reset regex
    JOB_ID_REGEX.lastIndex = 0;
    FIELD_REGEX.lastIndex = 0;
    
    // Extração principal
    while ((match = JOB_ID_REGEX.exec(text)) !== null) {
        const id = match[0];
        if (id.length >= 45 && id.length <= 70) {
            ids.add(id);
        }
    }
    
    // Extração de campos específicos
    while ((match = FIELD_REGEX.exec(text)) !== null) {
        const id = match[1];
        if (id && id.length >= 45 && id.length <= 70) {
            ids.add(id);
        }
    }
    
    return Array.from(ids);
}

// Processamento ultra-rápido de embeds
function fastProcessEmbeds(embeds) {
    let text = '';
    let jobIds = [];
    
    for (const embed of embeds) {
        // Concatena apenas campos essenciais
        if (embed.description) text += embed.description + ' ';
        if (embed.fields) {
            for (const field of embed.fields) {
                text += field.value + ' ';
                // Extração direta dos campos mais importantes
                if (field.name.toLowerCase().includes('server') || 
                    field.name.toLowerCase().includes('job')) {
                    const ids = fastExtractJobIds(field.value);
                    jobIds.push(...ids);
                }
            }
        }
        if (embed.title) text += embed.title + ' ';
    }
    
    // Extrai JobIds do texto concatenado
    const textIds = fastExtractJobIds(text);
    jobIds.push(...textIds);
    
    // Remove duplicatas usando Set (mais rápido)
    return [...new Set(jobIds)];
}

// Limpeza ultra-rápida do cache
function ultraCleanCache() {
    const now = Date.now();
    
    // Limpa cache principal
    for (const [key, data] of jobCache) {
        if (now - data.timestamp > CACHE_DURATION) {
            jobCache.delete(key);
        }
    }
    
    // Limpa cache de ultra-frescos
    for (const [key, data] of freshJobIds) {
        if (now - data.timestamp > ULTRA_FRESH_DURATION) {
            freshJobIds.delete(key);
        }
    }
    
    // Controle de tamanho
    if (jobCache.size > MAX_CACHE_SIZE) {
        const oldest = [...jobCache.entries()]
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, jobCache.size - MAX_CACHE_SIZE);
        
        for (const [key] of oldest) {
            jobCache.delete(key);
        }
    }
}

// Event listener ultra-otimizado
client.on('messageCreate', message => {
    // Filtros rápidos primeiro
    if (!message.author.bot) return;
    
    const username = message.author.username.toLowerCase();
    if (!username.includes('brainrot') && 
        !username.includes('notify') && 
        !username.includes('mirror')) return;
    
    // Processamento assíncrono para não bloquear
    setImmediate(() => {
        try {
            let allJobIds = [];
            
            // Prioriza embeds (mais rápido)
            if (message.embeds?.length > 0) {
                allJobIds = fastProcessEmbeds(message.embeds);
            } else if (message.content) {
                allJobIds = fastExtractJobIds(message.content);
            }
            
            if (allJobIds.length === 0) return;
            
            const now = Date.now();
            let newCount = 0;
            
            // Adiciona aos caches
            for (const jobId of allJobIds) {
                if (!jobCache.has(jobId)) {
                    const data = {
                        timestamp: now,
                        source: username
                    };
                    
                    jobCache.set(jobId, data);
                    freshJobIds.set(jobId, data); // Também no cache de frescos
                    newCount++;
                }
            }
            
            if (newCount > 0) {
                stats.total = jobCache.size;
                stats.fresh += newCount;
                stats.processed++;
                stats.lastJobId = allJobIds[0];
                
                // Reação assíncrona sem await (mais rápido)
                message.react('🎯').catch(() => {});
            }
            
        } catch (error) {
            // Log mínimo para não afetar performance
            console.error('E:', error.message);
        }
    });
});

// Eventos mínimos do bot
client.on('ready', () => console.log(`✅ ${client.user.tag} ONLINE`));
client.on('error', () => {}); // Silencia erros não críticos

// ENDPOINT ULTRA-RÁPIDO PRINCIPAL
app.get('/pets/fresh', (req, res) => {
    // Headers para máxima velocidade
    res.set({
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    
    try {
        const now = Date.now();
        
        // Usa o cache de ultra-frescos diretamente
        const freshData = [];
        for (const [jobId, data] of freshJobIds) {
            if (now - data.timestamp < ULTRA_FRESH_DURATION) {
                freshData.push({
                    jobId,
                    timestamp: data.timestamp,
                    source: data.source
                });
            }
        }
        
        // Ordena por timestamp (mais recente primeiro)
        freshData.sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({
            success: true,
            count: freshData.length,
            jobIds: freshData,
            timestamp: now
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Internal error' });
    }
});

// Status ultra-simples
app.get('/bot/status', (req, res) => {
    res.json({
        ...stats,
        cacheSize: jobCache.size,
        freshSize: freshJobIds.size,
        uptime: Date.now() - stats.startTime,
        connected: client.isReady()
    });
});

// Teste rápido
app.post('/bot/test', (req, res) => {
    const { text } = req.body;
    const jobIds = fastExtractJobIds(text || '');
    
    const now = Date.now();
    for (const jobId of jobIds) {
        jobCache.set(jobId, { timestamp: now, source: 'TEST' });
        freshJobIds.set(jobId, { timestamp: now, source: 'TEST' });
    }
    
    res.json({
        success: true,
        found: jobIds.length,
        jobIds
    });
});

// Root endpoint mínimo
app.get('/', (req, res) => {
    res.json({
        status: 'ULTRA FAST',
        uptime: Date.now() - stats.startTime,
        cache: jobCache.size,
        fresh: freshJobIds.size
    });
});

// Limpeza automática ultra-eficiente (apenas quando necessário)
let lastClean = Date.now();
setInterval(() => {
    // Limpa apenas se passou tempo suficiente OU cache está cheio
    if (Date.now() - lastClean > 30000 || jobCache.size > MAX_CACHE_SIZE) {
        ultraCleanCache();
        lastClean = Date.now();
    }
}, 5000); // Verifica a cada 5 segundos

// Keep-alive ultra-simples
const keepAliveUrl = `https://autojoin-api.onrender.com/bot/status`;
let keepAliveActive = true;

function ultraKeepAlive() {
    if (!keepAliveActive) return;
    
    require('https').get(keepAliveUrl, (res) => {
        // Só loga se houver erro
        if (res.statusCode !== 200) {
            console.log(`Keep-alive: ${res.statusCode}`);
        }
    }).on('error', () => {
        // Silencia erros de keep-alive
    });
    
    setTimeout(ultraKeepAlive, 14 * 60 * 1000); // 14 minutos
}

// Inicialização ultra-rápida
async function ultraStart() {
    try {
        // Bot Discord
        if (process.env.DISCORD_BOT_TOKEN) {
            await client.login(process.env.DISCORD_BOT_TOKEN);
            console.log('🤖 Bot ONLINE');
        }
        
        // Servidor
        app.listen(PORT, () => {
            console.log(`🚀 ULTRA FAST SERVER: ${PORT}`);
            console.log(`⚡ Fresh: /pets/fresh`);
            console.log(`📊 Status: /bot/status`);
            
            // Inicia keep-alive
            ultraKeepAlive();
        });
        
    } catch (error) {
        console.error('❌ Start error:', error.message);
        process.exit(1);
    }
}

// Cleanup rápido
process.on('SIGTERM', () => {
    keepAliveActive = false;
    process.exit(0);
});

process.on('SIGINT', () => {
    keepAliveActive = false;
    process.exit(0);
});

// Start
ultraStart();
