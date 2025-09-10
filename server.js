const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PLACE_ID = process.env.PLACE_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let botStatus = {
    online: false,
    jobsDetected: 0,
    lastJobDetected: null,
    startTime: new Date(),
};

function extractPCJobID(content) {
    try {
        const match = content.match(/Job ID \(PC\)[:\s]*([^\n]+)/i);
        if (match) return match[1].trim();
    } catch (err) {
        console.error('Erro ao extrair Job ID (PC):', err);
    }
    return null;
}

client.once('clientReady', () => {
    console.log('🤖 BOT ONLINE');
    botStatus.online = true;
});

client.on('messageCreate', (message) => {
    if (message.channel.id !== DISCORD_CHANNEL_ID) return;

    // Pode ser mensagem normal ou embed
    let content = message.content;
    if (message.embeds.length > 0) {
        const embed = message.embeds[0];
        content = embed.description || embed.title || content;
    }

    if (content.includes('Job ID (PC)')) {
        const jobIdPC = extractPCJobID(content);
        if (jobIdPC) {
            botStatus.jobsDetected++;
            botStatus.lastJobDetected = {
                jobIdPC,
                timestamp: new Date().toISOString(),
            };
            console.log(`🎯 Job ID (PC) detectado: ${jobIdPC}`);
            console.log(`🎮 Link do jogo: https://www.roblox.com/games/${PLACE_ID}?jobId=${jobIdPC}`);
        }
    }
});

client.on('error', (error) => {
    console.error('Erro no bot:', error);
    botStatus.online = false;
});

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        botStatus,
        uptimeSeconds: Math.floor((Date.now() - botStatus.startTime) / 1000),
        version: '1.0.0',
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

if (BOT_TOKEN) {
    client.login(BOT_TOKEN).then(() => {
        console.log('Bot logado com sucesso!');
    }).catch(console.error);
} else {
    console.error('Token do bot não encontrado!');
}

process.on('SIGINT', () => {
    console.log('Encerrando...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Encerrando...');
    client.destroy();
    process.exit(0);
});
