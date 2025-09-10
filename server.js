const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

// Configuração do Express
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());

// Configuração do Discord Bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Variáveis de ambiente
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PLACE_ID = process.env.PLACE_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Estado do bot
let botStatus = {
    online: false,
    jobsDetected: 0,
    lastJobDetected: null,
    startTime: new Date()
};

// Função para extrair um Job ID da mensagem (primeiro que encontrar)
function extractFirstJobID(content) {
    // Tenta achar formatos diferentes de job id (ex: base64, uuid, etc)
    const jobIdPatterns = [
        /[A-Za-z0-9+/]{20,}={0,2}/g,  // Base64-like (ajustar se quiser mais rigoroso)
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i  // UUID
    ];

    for (const pattern of jobIdPatterns) {
        const match = content.match(pattern);
        if (match && match.length > 0) {
            return match[0];
        }
    }

    return null;
}

// Evento: Bot pronto
client.once('clientReady', () => {
    console.log('🤖 Bot online e pronto!');
    botStatus.online = true;
});

// Monitoramento de mensagens
client.on('messageCreate', async (message) => {
    try {
        // Só processa mensagens do canal correto
        if (message.channel.id !== DISCORD_CHANNEL_ID) return;

        // Ignora mensagens de outros bots, mas NÃO ignora as do próprio bot
        if (message.author.bot && message.author.id !== client.user.id) return;

        // Conteúdo a analisar: texto puro + descrição do embed se tiver
        let content = message.content;
        if (message.embeds.length > 0) {
            const embed = message.embeds[0];
            if (embed.description) content += ' ' + embed.description;
        }

        // Extrai o primeiro Job ID válido encontrado
        const jobId = extractFirstJobID(content);
        if (!jobId) return; // Nenhum Job ID encontrado, ignora

        botStatus.jobsDetected++;
        botStatus.lastJobDetected = { jobId, timestamp: new Date().toISOString() };

        console.log(`Job ID detectado: ${jobId}`);
        console.log(`Mensagem de: ${message.author.username}`);
        console.log(`Canal: ${message.channel.id}`);

        // Se quiser, pode montar e mostrar o link direto
        const gameUrl = `https://www.roblox.com/games/${PLACE_ID}?jobId=${jobId}`;
        console.log(`Link do jogo: ${gameUrl}`);

    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
});

// Rotas básicas da API
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        botStatus,
        uptimeSeconds: Math.floor((Date.now() - botStatus.startTime) / 1000),
        version: '1.1.0'
    });
});

app.get('/status', (req, res) => {
    res.json(botStatus);
});

app.get('/last-job', (req, res) => {
    res.json({
        lastJob: botStatus.lastJobDetected,
        totalJobs: botStatus.jobsDetected
    });
});

// Inicia servidor HTTP
app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}`);
    console.log(`URL: https://autojoin-api.onrender.com`);
});

// Login do bot Discord
if (BOT_TOKEN) {
    client.login(BOT_TOKEN)
        .then(() => console.log('Bot logado com sucesso!'))
        .catch(err => console.error('Erro no login do bot:', err));
} else {
    console.error('Token do bot não encontrado!');
}

// Tratamento de encerramento
process.on('SIGTERM', () => {
    console.log('Encerrando aplicação...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Encerrando aplicação...');
    client.destroy();
    process.exit(0);
});
