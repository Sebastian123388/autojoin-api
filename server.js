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
        console.log('
 🔍
 Buscando mensagens do Discord...');
        const response = await axios.get(
            `${DISCORD_API}/channels/${CHANNEL_ID}/messages?limit=50`,
            {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`
 ✅
 ${response.data.length} mensagens encontradas`);
        return response.data;
    } catch (error) {
        console.error('
 ❌
 Erro ao buscar mensagens:', error.response?.data || error.message);
        return [];
    }
 }
 // Processar mensagens
 function processMessages(messages) {
    const processedData = [];
    
    messages.forEach(message => {
        // PADRÕES PARA DETECTAR - CUSTOMIZE AQUI!
        const patterns = [
            /JobId[:\s]*([a-f0-9-]{36})/i,
            /Job[:\s]*([a-f0-9-]{36})/i,
            /ID[:\s]*([a-f0-9-]{36})/i,
            /Server[:\s]*ID[:\s]*([a-f0-9-]{36})/i
        ];
        
        let jobIdFound = null;
        
        for (const pattern of patterns) {
            const match = message.content.match(pattern);
            if (match) {
                jobIdFound = match[1];
                break;
            }
        }
        
        if (jobIdFound) {
            // Buscar informações extras
            const serverMatch = message.content.match(/Server[:\s]*(\d+)/i);
            const petMatch = message.content.match(/Pet[:\s]*([^,\n\r]+)/i);
            const playerMatch = message.content.match(/Player[:\s]*([^,\n\r]+)/i);
            
            processedData.push({
                id: message.id,
                timestamp: message.timestamp,
                job_ids: [jobIdFound],
                server_info: serverMatch ? serverMatch[1] : null,
                pet_info: petMatch ? petMatch[1].trim() : null,
                player_info: playerMatch ? playerMatch[1].trim() : null,
                author: message.author.username,
                content: message.content.substring(0, 200), // Limita conteúdo
                fresh: true
            });
        }
    });
    
    // Ordena por timestamp (mais recente primeiro)
    return processedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
 }
 // ENDPOINT PRINCIPAL
 app.get('/pets', async (req, res) => {
    const now = Date.now();
    
    // Verifica cache
    if (now - lastFetch < CACHE_TIME && cachedData.length > 0) {
        console.log('
 📦
 Usando cache...');
        return res.json(cachedData);
    }
    
    try {
        const messages = await fetchDiscordMessages();
        const processedData = processMessages(messages);
        
        cachedData = processedData;
        lastFetch = now;
        
        console.log(`
 🚀
 Retornando ${processedData.length} entradas processadas`);
        res.json(processedData);
    } catch (error) {
        console.error('
 ❌
 Erro no endpoint:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            timestamp: new Date().toISOString()
        });
    }
 });
 // Endpoint de teste
 app.get('/test', (req, res) => {
    res.json({ 
        status: '
 ✅
 API Online!', 
        timestamp: new Date().toISOString(),
        config: {
            hasToken: !!DISCORD_TOKEN,
            hasChannelId: !!CHANNEL_ID,
            cacheEntries: cachedData.length
        }
    });
 });
 // Endpoint de status
 app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        cached_entries: cachedData.length,
        last_fetch: lastFetch ? new Date(lastFetch).toISOString() : null,
        next_fetch: lastFetch ? new Date(lastFetch + CACHE_TIME).toISOString() : null
    });
 });
 // Iniciar servidor
 const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`
 🚀
 Servidor rodando na porta ${PORT}`);
 console.log(`
 🔗
 Endpoints disponíveis:`);
 console.log(`   • GET /pets - Dados principais`);
 console.log(`   • GET /test - Teste da API`);
 console.log(`   • GET /status - Status do sistema`);
 if (!DISCORD_TOKEN || !CHANNEL_ID) {
 console.warn('
 ⚠
  ATENÇÃO: Configure as variáveis DISCORD_TOKEN e CHANNEL_ID!');
 }
 });
