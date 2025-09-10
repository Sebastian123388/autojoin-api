const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let botStatus = {
  online: false,
  jobsDetected: 0,
  lastJobDetected: null,
  startTime: new Date(),
};

const jobIdRegex = /[\w\d+/=]{20,}|\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi;

client.once('clientReady', () => {
  console.log(`🤖 Bot ${client.user.tag} online, monitorando canal ${DISCORD_CHANNEL_ID}`);
  botStatus.online = true;
});

client.on('messageCreate', message => {
  if (message.channel.id !== DISCORD_CHANNEL_ID) return;

  let text = message.content || '';
  if (message.embeds.length > 0) {
    text += ' ' + message.embeds.map(embed => embed.description || '').join(' ');
  }

  const jobIds = text.match(jobIdRegex);
  if (jobIds && jobIds.length > 0) {
    console.log('Job ID(s) detectado(s):', jobIds);
    botStatus.jobsDetected += jobIds.length;
    botStatus.lastJobDetected = jobIds[jobIds.length - 1];
  }
});

client.on('error', error => {
  console.error('Erro no bot Discord:', error);
  botStatus.online = false;
});

client.login(BOT_TOKEN).then(() => {
  console.log('✅ Bot logado com sucesso!');
}).catch(err => {
  console.error('❌ Erro no login do bot:', err);
});

// API simples para status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: botStatus,
    uptimeSeconds: Math.floor((Date.now() - botStatus.startTime) / 1000),
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});
