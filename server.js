const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
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

// Função para extrair Job ID (PC) de qualquer texto (captura vários formatos)
function extractJobId(text) {
  // Regex para pegar formatos tipo:
  // 7OHA5HNJu0RG0HkK4HuEP8mTGjKs/ARLBHGYcLuQyuHECVNXT4tF+AtNrbDJT5QHaOGIrkSKDplUBbtE7HEHDE1TCEuLHbuQ
  // 05c29fd8-bc0c-4ed1-9b30-c4551ac5bad4
  // Pode ajustar/expandir conforme formatos novos que apareçam

  const regexes = [
    /Job ID \(PC\)[:\s]*([\w+/=.-]{10,})/i,       // padrão com label "Job ID (PC)"
    /([\w+/=.-]{50,})/,                           // strings longas (>50 caracteres) que pareçam job id
    /([a-f0-9-]{36})/i,                          // UUID (36 chars)
  ];

  for (const regex of regexes) {
    const match = text.match(regex);
    if (match) return match[1].trim();
  }

  return null;
}

client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} online, monitorando canal ${DISCORD_CHANNEL_ID}`);
  botStatus.online = true;
});

client.on('messageCreate', (message) => {
  if (message.channel.id !== DISCORD_CHANNEL_ID) return;

  // Pega o conteúdo da mensagem ou do embed
  let content = message.content || '';

  if (message.embeds.length > 0) {
    const embed = message.embeds[0];
    content += '\n' + (embed.description || '') + '\n' + (embed.title || '');
  }

  const jobId = extractJobId(content);

  if (jobId) {
    botStatus.jobsDetected++;
    botStatus.lastJobId = jobId;

    console.log(`🎯 Job ID detectado: ${jobId}`);
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
