const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware básico
app.use(cors({ origin: '*' }));
app.use(express.json());

// CONFIGURAÇÕES
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// Zero state - completamente stateless
const MAX_MESSAGES = 3; // Apenas 3 mensagens mais recentes
const MAX_AGE = 3 * 1000; // 3 SEGUNDOS - milissegundos de delay

// Buscar mensagens com timeout mínimo
async function fetchDiscordMessages() {
    try {
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=${MAX_MESSAGES}`,
            {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 1000 // 1 segundo timeout
            }
        );
        
        return response.data;
        
    } catch (error) {
        console.error('Discord error:', error.message);
        return [];
    }
}

// Processar APENAS mensagens ultra-frescas
function getNewestJobId(messages) {
    const now = Date.now();
    
    // Apenas a mensagem mais recente que seja ultra-fresca
    for (const message of messages) {
        const messageAge = now - new Date(message.timestamp).getTime();
        
        // Skip se não for ultra-fresco
        if (messageAge > MAX_AGE) {
            continue;
        }
        
        // Conteúdo básico
        let content = message.content || '';
        if (message.embeds?.[0]?.title) {
            content += ' ' + message.embeds[0].title;
        }
        
        // Buscar Job ID
        const match = content.match(/([a-zA-Z0-9]{8,12})/);
        if (match) {
            const jobId = match[1];
            
            // Filtro básico
            if (!/^\d+$/.test(jobId) && !jobId.toLowerCase().includes('undefined')) {
                return {
                    job_id: jobId,
                    author: message.author.username,
                    age_ms: Math.floor(messageAge),
                    timestamp: message.timestamp
                };
            }
        }
    }
    
    return null;
}

// ENDPOINT PRINCIPAL - Completamente stateless
app.get('/pets', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const messages = await fetchDiscordMessages();
        
        if (messages.length === 0) {
            return res.json({ job_id: null, error: 'Discord unavailable' });
        }
        
        const jobData = getNewestJobId(messages);
        const processingTime = Date.now() - startTime;
        
        if (jobData) {
            console.log(`FRESH JOB: ${jobData.job_id} (${jobData.age_ms}ms ago)`);
            res.json({
                ...jobData,
                processing_ms: processingTime
            });
        } else {
            res.json({
                job_id: null,
                message: 'No ultra-fresh jobs',
                processing_ms: processingTime
            });
        }
        
    } catch (error) {
        res.json({
            job_id: null,
            error: error.message,
            processing_ms: Date.now() - startTime
        });
    }
});

// Health mínimo
app.get('/health', (req, res) => {
    res.json({
        status: 'stateless',
        max_age_seconds: MAX_AGE / 1000,
        uptime: Math.floor(process.uptime())
    });
});

// Test para keep-alive
app.get('/test', (req, res) => {
    res.json({ status: 'alive', timestamp: Date.now() });
});

// Debug - ver mensagens raw
app.get('/debug', async (req, res) => {
    try {
        const messages = await fetchDiscordMessages();
        const now = Date.now();
        
        const analysis = messages.map(msg => ({
            id: msg.id,
            author: msg.author.username,
            timestamp: msg.timestamp,
            age_ms: now - new Date(msg.timestamp).getTime(),
            is_fresh: (now - new Date(msg.timestamp).getTime()) <= MAX_AGE,
            content_preview: (msg.content || '').substring(0, 100),
            has_embeds: msg.embeds && msg.embeds.length > 0
        }));
        
        res.json({
            total_messages: messages.length,
            max_age_ms: MAX_AGE,
            fresh_messages: analysis.filter(a => a.is_fresh).length,
            messages: analysis
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// 404
app.use((req, res) => {
    res.json({ error: 'Not found' });
});

// Keep-alive
if (process.env.RENDER_SERVICE_NAME) {
    setInterval(async () => {
        try {
            await axios.get(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/test`);
        } catch (error) {
            // Silent fail
        }
    }, 2 * 60 * 1000); // A cada 2 minutos
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GHOST AutoJoin v8.0 - STATELESS - Port ${PORT}`);
    console.log(`Max age: ${MAX_AGE}ms (${MAX_AGE/1000}s)`);
    console.log(`Max messages: ${MAX_MESSAGES}`);
    console.log(`Mode: ULTRA-FRESH STATELESS`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('CONFIGURE TOKENS!');
    } else {
        console.log('STATELESS SYSTEM READY!');
    }
});
