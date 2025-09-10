const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Variáveis de ambiente obrigatórias
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!DISCORD_CHANNEL_ID || !BOT_TOKEN) {
  console.error('❌ Faltando DISCORD_CHANNEL_ID ou DISCORD_BOT_TOKEN nas variáveis de ambiente');
  process.exit(1);
}

// Inicializa o bot com os intents certos
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Estado simples do bot
let botOnline = false;

// Evento ready
client.once('ready', () => {
  console.log(`✅ Bot ${client.user.tag} online, monitorando canal ${DISCORD_CHANNEL_ID}`);
  botOnline = true;
});

// Evento para receber mensagens
client.on('messageCreate', (message) => {
  if (message.channel.id !== DISCORD_CHANNEL_ID) return;

  // Pega o conteúdo da mensagem + descrição do primeiro embed, se houver
  const content = message.content + (message.embeds[0]?.description || '');

  // Regex para capturar Job ID — aceita letras, números, -, +, /, =, e comprimento mínimo 20 (ajusta se quiser)
  const jobIdRegex = /[A-Za-z0-9\-+/=]{20,}/g;

  const matches = content.match(jobIdRegex);

  if (matches) {
    console.log('🎯 Job ID(s) detectado(s):', matches);
    // Aqui você pode salvar ou usar esses IDs como quiser
  }
});

// API básica só pra status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    botOnline,
    channelMonitoring: DISCORD_CHANNEL_ID,
    version: '1.0.0'
  });
});

// Starta servidor HTTP
app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// Faz login no Discord
client.login(BOT_TOKEN).catch(err => {
  console.error('❌ Erro ao logar no bot:', err);
  process.exit(1);
});

// Handle signals para desligar corretamente
process.on('SIGINT', () => {
  console.log('🛑 Encerrando aplicação...');
  client.destroy();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('🛑 Encerrando aplicação...');
  client.destroy();
  process.exit(0);
});
