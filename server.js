const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PLACE_ID = process.env.PLACE_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

let botStatus = {
  online: false,
  jobsDetected: 0,
  lastJobId: null,
  startTime: Date.now(),
};

function extractJobIdPC(text) {
  const regex = /Job ID \(PC\)[:\s]*([\w+/=.-]{10,})/i;
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} online, monitorando canal ${DISCORD_CHANNEL_ID}`);
  botStatus.online = true;
});

client.on('messageCreate', (message) => {
  if (message.channel.id !== DISCORD_CHANNEL_ID) return;

  const content = message.embeds.length ? (message.embeds[0].description || message.embeds[0].title || '') : message.content;
  if (!content.includes('Job ID (PC)')) return;

  const jobId = extractJobIdPC(content);
  if (jobId) {
    botStatus.jobsDetected++;
    botStatus.lastJobId = jobId;
    console.log(`🎯 Job ID (PC) detectado: ${jobId}`);
    console.log(`🎮 Link direto: https://www.roblox.com/games/${PLACE_ID}?jobId=${jobId}`);
  }
});

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    botStatus,
    uptimeSeconds: Math.floor((Date.now() - botStatus.startTime) / 1000),
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});

if (!BOT_TOKEN) {
  console.error('❌ Token do bot não encontrado!');
  process.exit(1);
}

client.login(BOT_TOKEN).then(() => {
  console.log('✅ Bot logado com sucesso!');
}).catch((err) => {
  console.error('❌ Erro ao logar o bot:', err);
  process.exit(1);
});

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
