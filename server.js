const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÕES - ALTERE AQUI!
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

// Cache
let cachedData = [];
let lastFetch = 0;
const CACHE_TIME = 30000; // 30 segundos

// Buscar mensagens do Discord
async function fetchDiscordMessages() {
    try {
        console.log('🔍 Buscando mensagens do Discord...');
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=50`,
            {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`✅ ${response.data.length} mensagens encontradas`);
        return response.data;
    } catch (error) {
        console.error('❌ Erro ao buscar mensagens:', error.response?.data || error.message);
        return [];
    }
}

// Processar mensagens - ATUALIZADO PARA SEU FORMATO
function processMessages(messages) {
    const processedData = [];
    
    messages.forEach(message => {
        console.log('📋 Processando mensagem:', message.content.substring(0, 100) + '...');
        
        // PADRÕES ESPECÍFICOS PARA BRAINROT NOTIFY
        const jobIdPatterns = [
            // Para "Job ID (Mobile)"
            /Job ID \(Mobile\)[:\s]*\n([a-zA-Z0-9]+)/i,
            // Para "Job ID (iOS)" 
            /Job ID \(iOS\)[:\s]*\n([a-zA-Z0-9]+)/i,
            // Para "Job ID (PC)"
            /Job ID \(PC\)[:\s]*\n([a-zA-Z0-9]+)/i,
            // Padrão genérico
            /Job ID[:\s]*\(.*?\)[:\s]*\n([a-zA-Z0-9]+)/i,
            // Fallback - qualquer Job ID
            /Job[:\s]*ID[:\s]*([a-zA-Z0-9]+)/i
        ];
        
        let jobIdFound = null;
        let platform = 'Unknown';
        
        for (const pattern of jobIdPatterns) {
            const match = message.content.match(pattern);
            if (match) {
                jobIdFound = match[1];
                
                // Determinar plataforma
                if (message.content.includes('(Mobile)')) platform = 'Mobile';
                else if (message.content.includes('(iOS)')) platform = 'iOS';
                else if (message.content.includes('(PC)')) platform = 'PC';
                
                console.log('🎯 Job ID encontrado:', jobIdFound, 'Plataforma:', platform);
                break;
            }
        }
        
        if (jobIdFound) {
            // Extrair informações adicionais
            const nameMatch = message.content.match(/Name[:\s]*\n(.+)/i);
            const moneyMatch = message.content.match(/Money per sec[:\s]*\n(.+)/i);
            const playersMatch = message.content.match(/Players[:\s]*\n(\d+\/\d+)/i);
            
            const processedEntry = {
                id: message.id,
                timestamp: message.timestamp,
                job_ids: [jobIdFound],
                platform: platform,
                server_name: nameMatch ? nameMatch[1].trim() : null,
                money_per_sec: moneyMatch ? moneyMatch[1].trim() : null,
                players: playersMatch ? playersMatch[1].trim() : null,
                author: message.author.username,
                content: message.content.substring(0, 300), // Primeiros 300 chars
                fresh: true
            };
            
            processedData.push(processedEntry);
            console.log('✅ Entrada processada:', processedEntry);
        } else {
            console.log('❌ Nenhum Job ID encontrado nesta mensagem');
        }
    });
    
    // Ordena por timestamp (mais recente primeiro)
    const sorted = processedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    console.log(`🚀 Total de ${sorted.length} entradas processadas`);
    return sorted;
}

// ENDPOINT PRINCIPAL
app.get('/pets', async (req, res) => {
    const now = Date.now();
    
    // Verifica cache
    if (now - lastFetch < CACHE_TIME && cachedData.length > 0) {
        console.log('📦 Usando cache...');
        return res.json(cachedData);
    }
    
    try {
        const messages = await fetchDiscordMessages();
        const processedData = processMessages(messages);
        
        cachedData = processedData;
        lastFetch = now;
        
        console.log(`🚀 Retornando ${processedData.length} entradas processadas`);
        res.json(processedData);
    } catch (error) {
        console.error('❌ Erro no endpoint:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de teste
app.get('/test', (req, res) => {
    res.json({ 
        status: '✅ API Online!', 
        timestamp: new Date().toISOString(),
        config: {
            hasToken: !!DISCORD_TOKEN,
            hasChannelId: !!CHANNEL_ID,
            cacheEntries: cachedData.length,
            lastFetch: lastFetch ? new Date(lastFetch).toISOString() : null
        },
        patterns: [
            'Job ID (Mobile)',
            'Job ID (iOS)', 
            'Job ID (PC)',
            'Brainrot Notify format'
        ]
    });
});

// Endpoint de status
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        cached_entries: cachedData.length,
        last_fetch: lastFetch ? new Date(lastFetch).toISOString() : null,
        next_fetch: lastFetch ? new Date(lastFetch + CACHE_TIME).toISOString() : null,
        sample_data: cachedData.slice(0, 2) // Primeiras 2 entradas como exemplo
    });
});

// Endpoint para debug - mostra mensagens raw
app.get('/debug', async (req, res) => {
    try {
        const messages = await fetchDiscordMessages();
        const rawMessages = messages.slice(0, 5).map(msg => ({
            id: msg.id,
            content: msg.content,
            author: msg.author.username,
            timestamp: msg.timestamp
        }));
        
        res.json({
            message: 'Últimas 5 mensagens do canal para debug',
            messages: rawMessages
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔗 Endpoints disponíveis:`);
    console.log(`   • GET /pets - Dados principais`);
    console.log(`   • GET /test - Teste da API`);
    console.log(`   • GET /status - Status do sistema`);
    console.log(`   • GET /debug - Debug de mensagens`);
    
    if (!DISCORD_TOKEN || !CHANNEL_ID) {
        console.warn('⚠️  ATENÇÃO: Configure as variáveis DISCORD_TOKEN e CHANNEL_ID!');
    } else {
        console.log('✅ Configuração OK - Pronto para detectar Job IDs do Brainrot Notify!');
    }
});
