// server.js - Bot Monitor do Chilli Hub - Leitura completa de Job IDs

const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

// Configuração do Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Configuração do Discord Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Variáveis de ambiente
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PLACE_ID = process.env.PLACE_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Estado do bot
let botStatus = {
  online: false,
  monitoring: false,
  lastJobsDetected: [],
  jobsDetectedCount: 0,
  startTime: new Date(),
};

// Função para extrair Job IDs do conteúdo
function extractJobIDs(content) {
  // Regex para Job IDs - aceita letras, números, hífen, +, / e =, a partir de 20 caracteres (ajuste se quiser)
  const jobIdRegex = /[A-Za-z0-9\-+/=]{20,}/g;
  return content.match(jobIdRegex) || [];
}

// Evento: Bot pronto
client.once('clientReady', () => {
  console.log('🤖 BOT ONLINE - CHILLI HUB MONITOR');
  console.log(`📱 Bot: ${client.user.tag}`);
  console.log(`📺 Canal monitorado: ${DISCORD_CHANNEL_ID}`);
  console.log(`🎮 Place ID: ${PLACE_ID}`);
  console.log('🔥 Modo: SOMENTE EXTRAÇÃO DE JOB IDs');
  console.log('════════════════════════════════════');
  botStatus.online = true;
  botStatus.monitoring = true;
});

// Evento: Monitorar mensagens
client.on('messageCreate', (message) => {
  try {
    if (message.channel.id !== DISCORD_CHANNEL_ID) return;

    // Pega todo texto da mensagem + todos os embeds (título, descrição e campos)
    const embedTexts = message.embeds
      .map((embed) => {
        let text = '';
        if (embed.title) text += embed.title + ' ';
        if (embed.description) text += embed.description + ' ';
        if (embed.fields && embed.fields.length > 0) {
          text += embed.fields.map((f) => f.name + ' ' + f.value).join(' ') + ' ';
        }
        return text.trim();
      })
      .join(' ');

    const fullContent = message.content + ' ' + embedTexts;

    const foundJobIds = extractJobIDs(fullContent);

    if (foundJobIds.length > 0) {
      botStatus.jobsDetectedCount += foundJobIds.length;
      botStatus.lastJobsDetected = foundJobIds;

      console.log(`🎯 Job ID(s) detectado(s):`, foundJobIds);
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
});

// Evento: Erro do bot
client.on('error', (error) => {
  console.error('❌ Erro do Discord Bot:', error);
  botStatus.online = false;
});

// Evento: Reconexão
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
    version: '1.0.0',
  });
});

app.get('/status', (req, res) => {
  res.json(botStatus);
});

app.get('/last-jobs', (req, res) => {
  res.json({
    lastJobs: botStatus.lastJobsDetected,
    totalJobs: botStatus.jobsDetectedCount,
  });
});

app.post('/test', (req, res) => {
  res.json({
    message: 'Bot está funcionando!',
    channelMonitoring: DISCORD_CHANNEL_ID,
    placeId: PLACE_ID,
    botOnline: botStatus.online,
  });
});

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// Login do bot Discord
if (BOT_TOKEN) {
  client
    .login(BOT_TOKEN)
    .then(() => {
      console.log('✅ Bot logado com sucesso!');
    })
    .catch((error) => {
      console.error('❌ Erro ao fazer login:', error);
    });
} else {
  console.error('❌ Token do bot não encontrado!');
}

// Tratamento de encerramento
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
