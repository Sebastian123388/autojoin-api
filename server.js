const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Cache de JobIds com timestamp ultra rápido
const jobCache = new Map();
const MAX_CACHE_SIZE = 1000;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Configuração do Bot Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel]
});

// Stats ultra rápidas
let stats = {
    totalJobIds: 0,
    freshJobIds: 0,
    messagesProcessed: 0,
    botStartTime: Date.now(),
    lastJobId: null,
    lastUpdate: null
};

// Função ultra rápida de limpeza do cache
function cleanCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, data] of jobCache.entries()) {
        if (now - data.timestamp > CACHE_DURATION) {
            keysToDelete.push(key);
        }
    }
    
    keysToDelete.forEach(key => jobCache.delete(key));
    
    // Limita tamanho do cache
    if (jobCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(jobCache.entries());
        const toDelete = entries
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, jobCache.size - MAX_CACHE_SIZE);
        
        toDelete.forEach(([key]) => jobCache.delete(key));
    }
}

// Detector ultra agressivo de JobIds
function extractJobIds(text) {
    if (!text || typeof text !== 'string') return [];
    
    const jobIdPatterns = [
        // Padrão principal do Roblox
        /[a-zA-Z0-9]{40,70}/g,
        // Padrões específicos observados
        /[a-zA-Z0-9\/\+]{50,}/g,
        // Job ID específico após dois pontos ou keywords
        /(?:Job\s*ID.*?[:=]\s*)([a-zA-Z0-9\/\+]{40,})/gi,
        // IDs em linhas separadas
        /^[a-zA-Z0-9\/\+]{45,}$/gm,
        // Padrões com underscores e hífens
        /[a-zA-Z0-9\/_\-]{40,}/g
    ];
    
    const foundJobIds = new Set();
    
    for (const pattern of jobIdPatterns) {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(match => {
                // Limpa o match se necessário
                const cleaned = match.replace(/^Job\s*ID.*?[:=]\s*/i, '').trim();
                if (cleaned.length >= 40 && cleaned.length <= 100) {
                    foundJobIds.add(cleaned);
                }
            });
        }
    }
    
    return Array.from(foundJobIds);
}

// Processamento ultra rápido de embeds
function processEmbeds(embeds) {
    let allText = '';
    let jobIds = [];
    
    console.log(`📋 PROCESSANDO ${embeds.length} EMBEDS:`);
    
    embeds.forEach((embed, index) => {
        console.log(`Embed ${index + 1}:`);
        
        // Título
        if (embed.title) {
            console.log(`  Título: ${embed.title}`);
            allText += embed.title + '\n';
        }
        
        // Descrição
        if (embed.description) {
            console.log(`  Descrição: ${embed.description.substring(0, 100)}...`);
            allText += embed.description + '\n';
        }
        
        // Campos (onde ficam os Job IDs)
        if (embed.fields && embed.fields.length > 0) {
            console.log(`  Campos: ${embed.fields.length}`);
            embed.fields.forEach(field => {
                console.log(`    ${field.name}: ${field.value}`);
                allText += `${field.name}: ${field.value}\n`;
                
                // Extrai JobIds diretamente dos campos
                const fieldJobIds = extractJobIds(field.value);
                jobIds.push(...fieldJobIds);
            });
        }
        
        // Footer
        if (embed.footer) {
            console.log(`  Footer: ${embed.footer.text}`);
            allText += embed.footer.text + '\n';
        }
        
        // Author
        if (embed.author) {
            console.log(`  Autor: ${embed.author.name}`);
            allText += embed.author.name + '\n';
        }
    });
    
    // Extrai JobIds de todo o texto também
    const textJobIds = extractJobIds(allText);
    jobIds.push(...textJobIds);
    
    // Remove duplicatas
    jobIds = [...new Set(jobIds)];
    
    console.log(`🎯 TOTAL DE JobIds EXTRAÍDOS DOS EMBEDS: ${jobIds.length}`);
    jobIds.forEach((id, i) => {
        console.log(`   ${i + 1}: ${id}`);
    });
    
    return { allText, jobIds };
}

// Event listener para mensagens do Discord
client.on('messageCreate', async message => {
    try {
        // Verifica se é o canal correto
        if (process.env.DISCORD_CHANNEL_ID && message.channel.id !== process.env.DISCORD_CHANNEL_ID) {
            return;
        }
        
        const isBot = message.author.bot;
        const username = message.author.username;
        const channelName = message.channel.name;
        
        console.log(`\n⚡ MENSAGEM RECEBIDA:`);
        console.log(`Canal: ${channelName} (${message.channel.id})`);
        console.log(`Autor: ${username} (Bot: ${isBot})`);
        console.log(`Tamanho: ${message.content?.length || 0} chars`);
        console.log(`Embeds: ${message.embeds?.length || 0}`);
        console.log(`Conteúdo: "${message.content || ''}"`);
        
        // Prioritário para bots conhecidos
        if (isBot && (username.toLowerCase().includes('brainrot') || 
                      username.toLowerCase().includes('notify') ||
                      username.toLowerCase().includes('mirror'))) {
            console.log(`🎯 BOT PRIORITÁRIO DETECTADO: ${username}!`);
        }
        
        let allJobIds = [];
        let processedText = '';
        
        // 1. Processa conteúdo de texto
        if (message.content) {
            console.log(`📝 PROCESSANDO TEXTO DA MENSAGEM...`);
            const textJobIds = extractJobIds(message.content);
            allJobIds.push(...textJobIds);
            processedText += message.content + '\n';
        }
        
        // 2. Processa embeds (PRINCIPAL para Brainrot Notify)
        if (message.embeds && message.embeds.length > 0) {
            console.log(`📋 PROCESSANDO EMBEDS...`);
            const { allText, jobIds } = processEmbeds(message.embeds);
            allJobIds.push(...jobIds);
            processedText += allText;
        }
        
        // Remove duplicatas
        allJobIds = [...new Set(allJobIds)];
        
        if (allJobIds.length > 0) {
            console.log(`🎯 ENCONTRADOS ${allJobIds.length} JobIds ÚNICOS:`);
            
            let newJobIds = 0;
            const now = Date.now();
            
            allJobIds.forEach((jobId, index) => {
                console.log(`   ${index + 1}: ${jobId}`);
                
                if (!jobCache.has(jobId)) {
                    jobCache.set(jobId, {
                        timestamp: now,
                        source: `${username} (${channelName})`,
                        placeId: process.env.PLACE_ID || '109983668079237'
                    });
                    newJobIds++;
                }
            });
            
            // Atualiza stats
            stats.totalJobIds = jobCache.size;
            stats.freshJobIds = newJobIds;
            stats.messagesProcessed++;
            stats.lastJobId = allJobIds[0];
            stats.lastUpdate = new Date().toISOString();
            
            console.log(`🚀 ULTRA RÁPIDO: ${newJobIds} novos JobIds adicionados (Total: ${jobCache.size})`);
            
            // Reação na mensagem
            try {
                if (newJobIds > 0) {
                    await message.react('🎯');
                    console.log(`🎭 Reação 🎯 adicionada - ${newJobIds} novos JobIds`);
                } else {
                    await message.react('✅');
                    console.log(`🎭 Reação ✅ adicionada - JobIds já conhecidos`);
                }
            } catch (error) {
                console.log(`❌ Erro ao reagir: ${error.message}`);
            }
            
        } else {
            console.log(`⏭️ Nenhum JobId encontrado`);
            stats.messagesProcessed++;
        }
        
        // Limpeza rápida do cache
        if (Math.random() < 0.1) { // 10% das vezes
            cleanCache();
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// Bot eventos
client.on('ready', () => {
    console.log(`✅ Bot conectado: ${client.user.tag}`);
});

client.on('error', (error) => {
    console.error('❌ Erro do Discord:', error);
});

// Endpoints da API Ultra Rápida
app.get('/pets/fresh', (req, res) => {
    try {
        const now = Date.now();
        const freshJobIds = Array.from(jobCache.entries())
            .filter(([_, data]) => now - data.timestamp < CACHE_DURATION)
            .map(([jobId, data]) => ({
                jobId,
                timestamp: data.timestamp,
                source: data.source,
                placeId: data.placeId
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
        
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json({
            success: true,
            count: freshJobIds.length,
            jobIds: freshJobIds,
            timestamp: now
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/bot/status', (req, res) => {
    res.json({
        ...stats,
        cacheSize: jobCache.size,
        uptime: Date.now() - stats.botStartTime,
        botConnected: client.isReady()
    });
});

// Endpoint de teste
app.post('/bot/test', (req, res) => {
    try {
        const { text } = req.body;
        const jobIds = extractJobIds(text);
        
        console.log(`🧪 TESTE MANUAL: "${text}"`);
        console.log(`🎯 JobIds encontrados: ${jobIds.length}`);
        
        jobIds.forEach((jobId, index) => {
            console.log(`   ${index + 1}: ${jobId}`);
            jobCache.set(jobId, {
                timestamp: Date.now(),
                source: 'TESTE_MANUAL',
                placeId: process.env.PLACE_ID || '109983668079237'
            });
        });
        
        res.json({
            success: true,
            jobIdsFound: jobIds.length,
            jobIds: jobIds,
            added: jobIds.length
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🚀 AutoJoin API Ultra Rápida Online!',
        endpoints: {
            '/pets/fresh': 'JobIds mais frescos',
            '/bot/status': 'Status do bot',
            '/bot/test': 'Teste manual (POST)'
        },
        stats
    });
});

// Inicialização
const startServer = async () => {
    try {
        // Inicia o bot Discord
        if (process.env.DISCORD_BOT_TOKEN) {
            await client.login(process.env.DISCORD_BOT_TOKEN);
            console.log('🤖 Bot Discord iniciado!');
        } else {
            console.log('⚠️ DISCORD_BOT_TOKEN não configurado');
        }
        
        // Inicia o servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
            console.log(`📡 API: https://autojoin-api.onrender.com`);
            console.log(`🎯 Fresh JobIds: https://autojoin-api.onrender.com/pets/fresh`);
        });
        
    } catch (error) {
        console.error('❌ Erro ao iniciar:', error);
        process.exit(1);
    }
};

startServer();
