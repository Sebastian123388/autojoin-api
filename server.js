const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

let botStatus = {
  online: false,
  jobsDetected: 0,
  lastJobDetected: null,
  startTime: new Date()
};

function extractSingleJobID(text) {
  if (!text) return null;

  const regexes = [
    /Job ID \(PC\)[:\s]*([A-Za-z0-9\-+/=]+)/i,
    /([A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12})/,
    /([A-Za-z0-9+/=]{20,})/
  ];

  for (const regex of regexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

client.once('clientReady', () => {
  console.log(`🤖 Bot ${client.user.tag} online, monitorando canal ${DISCORD_CHANNEL_ID}`);
  botStatus.online = true;
});

client.on('messageCreate', async (message) => {
  if (message.channel.id !== DISCORD_CHANNEL_ID) return;

  let content = message.content;
  if (message.embeds.length > 0) {
    const embed = message.embeds[0];
    content = embed.description || embed.title || content;
  }

  const jobId = extractSingleJobID(content);

  if (jobId) {
    botStatus.jobsDetected++;
    botStatus.lastJobDetected = { jobId, timestamp: new Date().toISOString() };
    console.log('🎯 Job ID detectado:', jobId);
    const gameUrl = `https://www.roblox.com/games/${PLACE_ID}?jobId=${jobId}`;
    console.log('🎮 Link:', gameUrl);
  }
});

client.on('error', (err) => {
  console.error('❌ Discord Bot Error:', err);
  botStatus.online = false;
});

client.on('reconnecting', () => {
  console.log('🔄 Reconectando ao Discord...');
});

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: botStatus,
    uptime: Math.floor((Date.now() - botStatus.startTime) / 1000),
    version: '1.0.0'
  });
});

app.get('/status', (req, res) => res.json(botStatus));

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

app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

if (BOT_TOKEN) {
  client.login(BOT_TOKEN)
    .then(() => console.log('✅ Bot logado com sucesso!'))
    .catch(err => console.error('❌ Erro ao fazer login:', err));
} else {
  console.error('❌ Token do bot não encontrado!');
}

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
