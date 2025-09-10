// server.js - Bot Monitor do Chilli Hub
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
  monitoring: false,
  lastJobDetected: null,
  jobsDetected: 0,
  startTime: new Date()
};

// Função para extrair todo texto dos embeds
function getFullEmbedContent(message) {
  if (!message.embeds.length) return '';

  return message.embeds.map(embed => {
    let text = '';

    if (embed.title) text += embed.title + '\n';
    if (embed.description) text += embed.description + '\n';

    if (embed.fields && embed.fields.length > 0) {
      embed.fields.forEach(field => {
        text += field.name + ': ' + field.value + '\n';
      });
    }

    return text;
  }).join('\n');
}

// Evento: Bot pronto
client.once('clientReady', () => {
  console.log('═══════════════════════════════════════');
  console.log('🤖 BOT ONLINE - CHILLI HUB MONITOR');
  console.log(`📱 Bot: ${client.user.tag}`);
  console.log(`📺 Canal: ${DISCORD_CHANNEL_ID}`);
  console.log(`🎮 Place ID: ${PLACE_ID}`);
  console.log(`🔥 Modo: LEVE - SOMENTE JOB ID`);
  console.log('═══════════════════════════════════════');

  botStatus.online = true;
  botStatus.monitoring = true;
});

// Listener de mensagens
client.on('messageCreate', async (message) => {
  try {
    // Aceitar mensagens de bots e usuários (não ignorar bots)

    // Verifica canal correto
    if (message.channel.id !== DISCORD_CHANNEL_ID) return;

    // Conteúdo completo: mensagem + embeds
    const fullText = message.content + '\n' + getFullEmbedContent(message);

    // Regex para capturar Job ID - combina os tipos que você mostrou
    // UUID padrão e string alfanumérica com símbolos usados
    const jobIdRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[A-Za-z0-9+/=]{16,64})/g;

    const matches = [...fullText.matchAll(jobIdRegex)];

    if (matches.length > 0) {
      const jobId = matches[0][0];
      console.log(`✅ Job ID detectado: ${jobId}`);

      botStatus.jobsDetected++;
      botStatus.lastJobDetected = {
        jobId,
        timestamp: new Date().toISOString()
      };

      console.log(`🎮 Link do jogo: https://www.roblox.com/games/${PLACE_ID}?jobId=${jobId}`);

    } else {
      console.log('❌ Nenhum Job ID encontrado nessa mensagem');
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

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
  console.log(`🔗 URL: https://autojoin-api.onrender.com`);
});

// Login do bot Discord
if (BOT_TOKEN) {
  client.login(BOT_TOKEN)
    .then(() => {
      console.log('✅ Bot logado com sucesso!');
    })
    .catch(error => {
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
