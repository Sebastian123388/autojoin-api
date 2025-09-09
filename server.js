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

// Função para extrair informações do job
function extractJobInfo(content) {
    const jobInfo = {
        timestamp: new Date().toISOString(),
        raw: content
    };
    
    try {
        // Extrair nome do servidor
        const nameMatch = content.match(/💰\s*Name[:\s]*([^\n]+)/i) || 
                         content.match(/Name[:\s]*([^\n]+)/i);
        if (nameMatch) jobInfo.serverName = nameMatch[1].trim();
        
        // Extrair dinheiro por segundo
        const moneyMatch = content.match(/💰\s*Money per sec[:\s]*([^\n]+)/i) ||
                          content.match(/Money per sec[:\s]*([^\n]+)/i);
        if (moneyMatch) jobInfo.moneyPerSec = moneyMatch[1].trim();
        
        // Extrair players
        const playersMatch = content.match(/💎\s*Players[:\s]*([^\n]+)/i) ||
                            content.match(/Players[:\s]*([^\n]+)/i);
        if (playersMatch) jobInfo.players = playersMatch[1].trim();
        
        // Extrair Job IDs
        const mobileMatch = content.match(/Job ID \(Mobile\)[:\s]*([^\n]+)/i);
        if (mobileMatch) jobInfo.jobIdMobile = mobileMatch[1].trim();
        
        const iosMatch = content.match(/Job ID \(iOS\)[:\s]*([^\n]+)/i);
        if (iosMatch) jobInfo.jobIdIOS = iosMatch[1].trim();
        
        const pcMatch = content.match(/Job ID \(PC\)[:\s]*([^\n]+)/i);
        if (pcMatch) jobInfo.jobIdPC = pcMatch[1].trim();
        
    } catch (error) {
        console.error('❌ Erro ao extrair informações do job:', error);
    }
    
    return jobInfo;
}

// Função para verificar se é mensagem de job
function isJobMessage(message) {
    const content = message.content;
    const embedContent = message.embeds?.[0]?.description || '';
    const fullContent = content + ' ' + embedContent;
    
    // Indicadores de mensagem de job
    const hasJobId = fullContent.includes('Job ID');
    const hasMoneyOrPlayers = fullContent.includes('Money per sec') || 
                             fullContent.includes('Players') ||
                             fullContent.includes('💰') ||
                             fullContent.includes('💎');
    
    return hasJobId && hasMoneyOrPlayers;
}

// Função para verificar se tem Job ID do PC
function hasPCJobID(message) {
    const content = message.content;
    const embedContent = message.embeds?.[0]?.description || '';
    const fullContent = content + ' ' + embedContent;
    
    return fullContent.includes('Job ID (PC)');
}

// Função para extrair Job ID do PC
function extractPCJobID(content) {
    const jobInfo = {
        timestamp: new Date().toISOString(),
        raw: content
    };
    
    try {
        // Extrair nome do servidor
        const nameMatch = content.match(/💰\s*Name[:\s]*([^\n]+)/i) || 
                         content.match(/Name[:\s]*([^\n]+)/i);
        if (nameMatch) jobInfo.serverName = nameMatch[1].trim();
        
        // Extrair dinheiro por segundo
        const moneyMatch = content.match(/💰\s*Money per sec[:\s]*([^\n]+)/i) ||
                          content.match(/Money per sec[:\s]*([^\n]+)/i);
        if (moneyMatch) jobInfo.moneyPerSec = moneyMatch[1].trim();
        
        // Extrair players
        const playersMatch = content.match(/💎\s*Players[:\s]*([^\n]+)/i) ||
                            content.match(/Players[:\s]*([^\n]+)/i);
        if (playersMatch) jobInfo.players = playersMatch[1].trim();
        
        // Extrair Job ID do PC
        const pcMatch = content.match(/Job ID \(PC\)[:\s]*([^\n]+)/i);
        if (pcMatch) jobInfo.jobIdPC = pcMatch[1].trim();
        
    } catch (error) {
        console.error('❌ Erro ao extrair Job ID do PC:', error);
    }
    
    return jobInfo;
}

// Event: Bot pronto
client.once('ready', () => {
    console.log('═══════════════════════════════════════');
    console.log('🤖 BOT ONLINE - CHILLI HUB MONITOR');
    console.log(`📱 Bot: ${client.user.tag}`);
    console.log(`📺 Canal: ${DISCORD_CHANNEL_ID}`);
    console.log(`🎮 Place ID: ${PLACE_ID}`);
    console.log(`🔥 Modo: REAL TIME MONITORING`);
    console.log('⚠️  MONITORANDO BOTS E USUÁRIOS');
    console.log('═══════════════════════════════════════');
    
    botStatus.online = true;
    botStatus.monitoring = true;
});

// Event: Monitor de mensagens
client.on('messageCreate', async (message) => {
    try {
        // LOG DE DEBUG: Toda mensagem que chega
        console.log(`🔍 [DEBUG] Mensagem recebida:`);
        console.log(`   📍 Canal: ${message.channel.id} (esperado: ${DISCORD_CHANNEL_ID})`);
        console.log(`   👤 Autor: ${message.author.username} (bot: ${message.author.bot})`);
        console.log(`   📝 Conteúdo: ${message.content.substring(0, 100)}...`);
        console.log(`   📎 Embeds: ${message.embeds.length}`);
        
        // ❌ REMOVIDO: Filtro que ignorava bots
        // if (message.author.bot) {
        //     console.log(`❌ Ignorando bot: ${message.author.username}`);
        //     return;
        // }
        
        // Agora aceita mensagens de bots E usuários
        if (message.author.bot) {
            console.log(`🤖 Processando mensagem de bot: ${message.author.username}`);
        } else {
            console.log(`👤 Processando mensagem de usuário: ${message.author.username}`);
        }
        
        // Filtro: Verifica canal
        if (message.channel.id !== DISCORD_CHANNEL_ID) {
            console.log(`❌ Canal diferente. Recebido: ${message.channel.id}, Esperado: ${DISCORD_CHANNEL_ID}`);
            return;
        }
        
        console.log(`✅ Mensagem válida de: ${message.author.username}`);
        console.log(`📄 Conteúdo completo: ${message.content}`);
        
        // Verifica se tem conteúdo em embeds
        if (message.embeds.length > 0) {
            console.log(`📎 Embed detectado:`);
            message.embeds.forEach((embed, index) => {
                console.log(`   Embed ${index + 1}:`);
                console.log(`   📝 Title: ${embed.title || 'N/A'}`);
                console.log(`   📄 Description: ${embed.description?.substring(0, 200) || 'N/A'}...`);
            });
        }
        
        // Verifica se tem Job ID do PC
        const hasPC = hasPCJobID(message);
        console.log(`🔍 Tem Job ID (PC)? ${hasPC ? '✅ SIM' : '❌ NÃO'}`);
        
        if (hasPC) {
            botStatus.jobsDetected++;
            
            console.log('🎯 ══════ JOB ID PC DETECTADO ══════');
            
            // Pega conteúdo da mensagem ou embed
            let content = message.content;
            if (message.embeds.length > 0) {
                const embed = message.embeds[0];
                content = embed.description || embed.title || content;
                console.log(`📄 Usando conteúdo do embed: ${content.substring(0, 100)}...`);
            }
            
            // Extrai Job ID do PC
            const jobData = extractPCJobID(content);
            botStatus.lastJobDetected = jobData;
            
            if (jobData.jobIdPC) {
                console.log('💻 JOB ID (PC):');
                console.log(`   🔑 ${jobData.jobIdPC}`);
                console.log('');
                console.log('📋 CONTEXTO:');
                console.log(`   🏷️  Servidor: ${jobData.serverName || 'N/A'}`);
                console.log(`   💰 Money/sec: ${jobData.moneyPerSec || 'N/A'}`);
                console.log(`   👥 Players: ${jobData.players || 'N/A'}`);
                console.log(`   ⏰ Detectado: ${new Date().toLocaleString()}`);
                
                // URL do jogo para facilitar
                const gameUrl = `https://www.roblox.com/games/${PLACE_ID}?jobId=${jobData.jobIdPC}`;
                console.log('');
                console.log('🎮 LINK DIRETO:');
                console.log(`   ${gameUrl}`);
                
            } else {
                console.log('⚠️  Job ID (PC) não encontrado na mensagem');
                console.log('🔍 Conteúdo analisado:');
                console.log(content);
            }
            
            console.log('════════════════════════════════════');
            
        } else {
            console.log('💬 Mensagem sem Job ID (PC)');
        }
        
        console.log('─'.repeat(50));
        
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// Event: Erro do bot
client.on('error', (error) => {
    console.error('❌ Erro do Discord Bot:', error);
    botStatus.online = false;
});

// Event: Reconexão
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

// Rota para testar o bot
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
