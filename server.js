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

// Rate limiting INSANO - sem limites para velocidade máxima
const limiter = rateLimit({
    windowMs: 1 * 1000, // 1 segundo
    max: 2000, // 2000 requests por segundo - FLASH MODE
    message: { error: 'Calm down Flash!' }
});
app.use(limiter);

// CONFIGURAÇÕES
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// Variáveis para controle
let totalRequests = 0;
let successRequests = 0;
let lastError = null;
let processedMessageIds = new Set(); // Track de mensagens já processadas

const MAX_MESSAGES = 5; // MÍNIMO ABSOLUTO - apenas as 5 mais recentes
const MAX_AGE = 5 * 1000; // 5 SEGUNDOS - INSTANTÂNEO MESMO
const MAX_PROCESSED_IDS = 100; // Limite do cache de IDs processadas

// Health simples
let serverHealth = {
    status: 'starting',
    discordConnected: false,
    lastCheck: 0
};

// Buscar mensagens INSTANTÂNEO
async function fetchDiscordMessages() {
    try {
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=${MAX_MESSAGES}`,
            {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 1500 // 1.5 segundos timeout - ULTRA RÁPIDO
            }
        );
        
        serverHealth.discordConnected = true;
        serverHealth.lastCheck = Date.now();
        
        return response.data;
        
    } catch (error) {
        serverHealth.discordConnected = false;
        lastError = {
            message: error.message,
            timestamp: new Date().toISOString()
        };
        return [];
    }
}

// Processar APENAS 1 JOB ID POR VEZ
function processFirstJobId(messages) {
    const now = Date.now();
    
    // Processar mensagens da mais nova para mais antiga
    for (const message of messages) {
        const messageAge = now - new Date(message.timestamp).getTime();
        
        // Skip mensagens antigas ou já processadas
        if (messageAge > MAX_AGE || processedMessageIds.has(message.id)) {
            continue;
        }
        
        // Conteúdo mínimo
        let content = message.content || '';
        
        // Adicionar título do embed se existir
        if (message.embeds?.[0]?.title) {
            content += ' ' + message.embeds[0].title;
        }
        
        // Buscar primeiro Job ID válido
        const jobIdMatch = content.match(/([a-zA-Z0-9]{8,12})/);
        
        if (jobIdMatch) {
            const jobId = jobIdMatch[1];
            
            // Filtro básico de falsos positivos
            const lower = jobId.toLowerCase();
            if (!lower.includes('javascript') && 
                !lower.includes('undefined') && 
                !lower.includes('function') &&
                !/^\d+$/.test(jobId)) { // Skip números puros
                
                // Marcar mensagem como processada
                processedMessageIds.add(message.id);
                
                // Limpar cache se muito grande
                if (processedMessageIds.size > MAX_PROCESSED_IDS) {
                    const idsArray = Array.from(processedMessageIds);
                    processedMessageIds = new Set(idsArray.slice(-50)); // Manter apenas os 50 mais recentes
                }
                
                console.log(`⚡ NOVO JOB ID: ${jobId} (${Math.floor(messageAge/1000)}s atrás)`);
                
                return {
                    job_id: jobId,
                    author: message.author.username,
                    seconds_ago: Math.floor(messageAge / 1000),
                    message_id: message.id
                };
            }
        }
    }
    
    return null; // Nenhum Job ID novo encontrado
}

// ENDPOINT PRINCIPAL - RETORNA APENAS 1 JOB ID NOVO POR VEZ
app.get('/pets', async (req, res) => {
    totalRequests++;
    const startTime = Date.now();
    
    // Headers para velocidade máxima
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Fresh-Data': 'instant',
        'X-Mode': 'single-job'
    });
    
    try {
        const messages = await fetchDiscordMessages();
        
        if (messages.length === 0) {
            return res.json({
                job_id: null,
                message: 'Discord unavailable',
                ms: Date.now() - startTime
            });
        }
        
        const newJobData = processFirstJobId(messages);
        const processingTime = Date.now() - startTime;
        
        successRequests++;
        serverHealth.status = 'instant';
        
        if (newJobData) {
            console.log(`🚀 Retornando Job ID em ${processingTime}ms`);
            res.json({
                ...newJobData,
                ms: processingTime,
                fresh: true
            });
        } else {
            // Nenhum Job ID novo
            res.json({
                job_id: null,
                message: 'No new jobs',
                ms: processingTime,
                fresh: true
            });
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.json({
            job_id: null,
            error: 'Server error',
            ms: Date.now() - startTime
        });
    }
});

// Health check ultra simples
app.get('/health', (req, res) => {
    res.json({
        status: serverHealth.status,
        discord: serverHealth.discordConnected,
        processed_count: processedMessageIds.size,
        uptime: `${Math.floor(process.uptime())}s`,
        mode: 'single-job-instant'
    });
});

// Test endpoint para keep-alive
app.get('/test', (req, res) => {
    res.json({
        status: 'alive',
        timestamp: Date.now(),
        mode: 'instant'
    });
});

// Limpar cache de IDs processadas periodicamente
setInterval(() => {
    if (processedMessageIds.size > MAX_PROCESSED_IDS) {
        const idsArray = Array.from(processedMessageIds);
        processedMessageIds = new Set(idsArray.slice(-30)); // Manter apenas os 30 mais recentes
        console.log('🧹 Cache de IDs processadas limpo');
    }
}, 5 * 60 * 1000); // A cada 5 minutos

// 404 handler
app.use((req, res) => {
    res.json({
        error: 'Endpoint not found',
        endpoints: ['/pets', '/health', '/test']
    });
});

// Keep-alive para Render
if (process.env.RENDER_SERVICE_NAME) {
    setInterval(async () => {
        try {
            await axios.get(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/test`);
            console.log('🏓 Keep-alive');
        } catch (error) {
            console.log('⚠️ Keep-alive falhou');
        }
    }, 3 * 60 * 1000); // A cada 3 minutos
}

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Ghost AutoJoin v7.0 - SINGLE JOB MODE - Porta ${PORT}`);
    console.log(`⚡ MODO: 1 JOB ID POR VEZ - ${MAX_AGE/1000}s máximo`);
    console.log(`🎯 Endpoint: GET /pets (retorna apenas 1 job novo)`);
    console.log(`⚡ Configurações:`);
    console.log(`   • ${MAX_AGE/1000}s idade máxima`);
    console.log(`   • ${MAX_MESSAGES} mensagens verificadas`);
    console.log(`   • 1.5s timeout`);
    console.log(`   • 2000 req/s rate limit`);
    console.log(`   • Track de ${MAX_PROCESSED_IDS} IDs processadas`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('⚠️ CONFIGURE TOKENS!');
        serverHealth.status = 'config_error';
    } else {
        console.log('✅ SISTEMA SINGLE JOB OPERACIONAL!');
        serverHealth.status = 'instant';
    }
});
