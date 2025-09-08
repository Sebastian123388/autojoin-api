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

// Processar mensagens - CORRIGIDO PARA EMBEDS
function processMessages(messages) {
    const processedData = [];
    
    messages.forEach(message => {
        console.log('📋 Processando mensagem ID:', message.id);
        
        // Se a mensagem tem embeds, processar eles
        if (message.embeds && message.embeds.length > 0) {
            message.embeds.forEach((embed, embedIndex) => {
                console.log(`🔍 Processando embed ${embedIndex}:`, embed.title);
                
                // Verificar se é um embed do Brainrot Notify
                if (embed.title && embed.title.includes('Brainrot Notify')) {
                    
                    let serverName = null;
                    let moneyPerSec = null;
                    let players = null;
                    let jobIds = [];
                    
                    // Processar campos do embed
                    if (embed.fields && embed.fields.length > 0) {
                        embed.fields.forEach(field => {
                            const fieldName = field.name.toLowerCase();
                            const fieldValue = field.value;
                            
                            console.log(`  📌 Campo: "${field.name}" = "${fieldValue}"`);
                            
                            // Extrair informações baseado no nome do campo
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
                                // Determinar plataforma
                                let platform = 'Unknown';
                                if (fieldName.includes('mobile')) platform = 'Mobile';
                                else if (fieldName.includes('ios')) platform = 'iOS';
                                else if (fieldName.includes('pc')) platform = 'PC';
                                
                                jobIds.push({
                                    id: fieldValue.trim(),
                                    platform: platform
                                });
                                
                                console.log(`🎯 Job ID encontrado: ${fieldValue.trim()} (${platform})`);
                            }
                        });
                    }
                    
                    // Se encontrou pelo menos um Job ID, criar entrada
                    if (jobIds.length > 0) {
                        jobIds.forEach(jobId => {
                            const processedEntry = {
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
                            };
                            
                            processedData.push(processedEntry);
                            console.log('✅ Entrada processada:', {
                                platform: jobId.platform,
                                server: serverName,
                                money: moneyPerSec,
                                job_id: jobId.id.substring(0, 20) + '...'
                            });
                        });
                    }
                }
            });
        }
        
        // Fallback: se não tem embeds, tentar processar o content (código original)
        else if (message.content && message.content.trim().length > 0) {
            console.log('📝 Processando content da mensagem...');
            
            const jobIdPatterns = [
                /Job ID \(Mobile\)[:\s]*\n([a-zA-Z0-9]+)/i,
                /Job ID \(iOS\)[:\s]*\n([a-zA-Z0-9]+)/i,
                /Job ID \(PC\)[:\s]*\n([a-zA-Z0-9]+)/i,
                /Job ID[:\s]*\(.*?\)[:\s]*\n([a-zA-Z0-9]+)/i,
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
                    
                    console.log('🎯 Job ID encontrado no content:', jobIdFound, 'Plataforma:', platform);
                    break;
                }
            }
            
            if (jobIdFound) {
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
                    content: message.content.substring(0, 300),
                    fresh: true
                };
                
                processedData.push(processedEntry);
                console.log('✅ Entrada processada do content:', processedEntry);
            }
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
            'Brainrot Notify format - EMBEDS'
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

// Endpoint para debug - mostra mensagens raw COM EMBEDS
app.get('/debug', async (req, res) => {
    try {
        const messages = await fetchDiscordMessages();
        const rawMessages = messages.slice(0, 5).map(msg => ({
            id: msg.id,
            content: msg.content,
            author: msg.author.username,
            timestamp: msg.timestamp,
            has_embeds: msg.embeds && msg.embeds.length > 0,
            embeds: msg.embeds ? msg.embeds.map(embed => ({
                title: embed.title,
                description: embed.description,
                fields: embed.fields ? embed.fields.map(field => ({
                    name: field.name,
                    value: field.value
                })) : []
            })) : []
        }));
        
        res.json({
            message: 'Últimas 5 mensagens do canal para debug (com embeds)',
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
        console.log('✅ Configuração OK - Pronto para detectar Job IDs do Brainrot Notify (EMBEDS)!');
    }
});
