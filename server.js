// server.js - Bot Monitor do Chilli Hub (otimizado)
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configuração do bot Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PLACE_ID = process.env.PLACE_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Estado do bot
let botStatus = {
    online: false,
    monitoring: false,
    lastJobDetected: null,
    jobsDetected: 0,
    startTime: new Date()
};

// 👉 Função leve para extrair apenas Job ID (PC)
function extractPCJobID(content) {
    const match = content.match(/Job ID \(PC\)[:\s]*([^\n]+)/i);
    return match ? match[1].trim() : null;
}

// Verifica se tem Job ID (PC) na mensagem
function hasPCJobID(message) {
    const content = message.content;
    const embedContent = message.embeds?.[0]?.description || '';
    const fullContent = content + ' ' + embedContent;

    return fullContent.includes('Job ID (PC)');
}

// Event: Bot pronto
client.once('ready', () => {
    console.log('═══════════════════════════════════════');
    console.log('🤖 BOT ONLINE - CHILLI HUB MONITOR');
    console.log(`📱 Bot: ${client.user.tag}`);
    console.log(`📺 Canal: ${DISCORD_CHANNEL_ID}`);
    console.log(`🎮 Place ID: ${PLACE_ID}`);
    console.log(`🔥 Modo: LEVE - SOMENTE JOB ID (PC)`);
    console.log('═══════════════════════════════════════');

    botStatus.online = true;
    botStatus.monitoring = true;
});

// Event: Monitor de mensagens
client.on('messageCreate', async (message) => {
    try {
        // Ignora mensagens de outros canais
        if (message.channel.id !== DISCORD_CHANNEL_ID) return;

        // Verifica se a mensagem tem Job ID (PC)
        if (!hasPCJobID(message)) return;

        // Extrai conteúdo da mensagem
        let content = message.content;
        if (message.embeds.length > 0) {
            const embed = message.embeds[0];
            content = embed.description || embed.title || content;
        }

        // Extrai apenas o Job ID (PC)
        const jobIdPC = extractPCJobID(content);
        if (!jobIdPC) return;

        // Atualiza status
        botStatus.jobsDetected++;
        botStatus.lastJobDetected = {
            jobIdPC,
            timestamp: new Date().toISOString()
        };

        // Log
        console.log('🎯 JOB ID (PC) DETECTADO:');
        console.log(`🔑 ${jobIdPC}`);
        console.log(`🔗 https://www.roblox.com/games/${PLACE_ID}?jobId=${jobIdPC}`);
        console.log('─'.repeat(50));
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// Eventos de controle
client.on('error', (error) => {
    console.error('❌ Erro do Discord Bot:', error);
    botStatus.online = false;
});

client.on('reconnecting', () => {
    console.log('🔄 Reconectando ao Discord...');
});

// Rotas da API
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Chilli Hub Monitor',
        bot: botStatus,
        uptime: Math.floor((Date.now() - botStatus.startTime) / 1000),
        version: '1.0.0'
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

app.post('/test', (req, res) => {
    res.json({
        message: 'Bot está funcionando!',
        channelMonitoring: DISCORD_CHANNEL_ID,
        placeId: PLACE_ID,
        botOnline: botStatus.online
    });
});

// Inicialização do servidor HTTP
app.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
    console.log(`🔗 URL: https://autojoin-api.onrender.com`);
});

// Login do bot
if (!BOT_TOKEN) {
    console.error('❌ Token do bot não encontrado!');
    process.exit(1);
}

client.login(BOT_TOKEN)
    .then(() => {
        console.log('✅ Bot logado com sucesso!');
    })
    .catch(error => {
        console.error('❌ Erro ao fazer login:', error);
    });

// Encerramento seguro
process.on('SIGTERM', () => {
    console.log('🛑 Encerrando aplicação...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Encerrando aplicação...');
    client.destroy();
    process.exit(0);
});
