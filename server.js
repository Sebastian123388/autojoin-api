const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');
const app = express();

// Middleware com configuração anti-cache
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));

app.use(express.json());

// Headers anti-cache global
app.use((req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

const PORT = process.env.PORT || 3000;

// CONFIGURAÇÃO ULTRA RÁPIDA
const DISCORD_CONFIG = {
    TOKEN: process.env.DISCORD_BOT_TOKEN || '',
    CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || '',
    PLACE_ID: process.env.PLACE_ID || '109983668079237',
    // Padrões ultra agressivos para detectar JobIds
    JOB_ID_PATTERNS: [
        /Job ID \([^)]+\)\s*\n([A-Za-z0-9_-]{20,})/gi,
        /JobId[:\s]+([A-Za-z0-9_-]{20,})/gi,
        /Job[:\s]+([A-Za-z0-9_-]{20,})/gi,
        /Server ID[:\s]+([A-Za-z0-9_-]{20,})/gi,
        /ID[:\s]+([A-Za-z0-9_-]{20,})/gi,
        /([A-Za-z0-9_-]{30,})/g, // IDs longos genéricos
        /([A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12})/g // UUIDs
    ]
};

// Base de dados ultra rápida (apenas em memória)
let pets = [{
    id: 1,
    name: "Discord Ultra-Fast",
    rarity: "Fresh",
    job_ids: [],
    source: "discord",
    fresh: true,
    last_updated: new Date().toISOString()
}];

let botStats = {
    messagesProcessed: 0,
    jobIdsFound: 0,
    lastActivity: new Date().toISOString(),
    botStatus: 'Disconnected'
};

let discordBot = null;

// FUNÇÃO ULTRA RÁPIDA - sem filtros de duplicata
function addNewJobIds(newJobIds, source = 'discord') {
    if (newJobIds.length === 0) return 0;
    
    console.log(`⚡ MODO TURBO: Adicionando ${newJobIds.length} JobIds instantaneamente`);
    
    let discordPet = pets.find(p => p.source === source);
    if (!discordPet) {
        discordPet = {
            id: Date.now(),
            name: "Discord Ultra-Fast",
            rarity: "Fresh",
            job_ids: [],
            source: source,
            fresh: true,
            last_updated: new Date().toISOString()
        };
        pets.unshift(discordPet); // Adiciona no início
    }

    // ADICIONA TODOS os JobIds (sem verificar duplicatas para máxima velocidade)
    discordPet.job_ids.unshift(...newJobIds);
    discordPet.fresh = true;
    discordPet.last_updated = new Date().toISOString();
    
    // Mantém apenas os 10 mais recentes para velocidade máxima
    if (discordPet.job_ids.length > 10) {
        discordPet.job_ids = discordPet.job_ids.slice(0, 10);
    }

    // Atualiza estatísticas
    botStats.jobIdsFound += newJobIds.length;
    botStats.lastActivity = new Date().toISOString();
    
    console.log(`🚀 ULTRA RÁPIDO: ${newJobIds.length} JobIds adicionados - Total: ${discordPet.job_ids.length}`);
    return newJobIds.length;
}

// EXTRAÇÃO ULTRA AGRESSIVA de JobIds
function extractJobIds(text) {
    const foundIds = new Set();
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    
    console.log(`🔍 ANALISANDO TEXTO: "${cleanText.substring(0, 100)}..."`);
    
    DISCORD_CONFIG.JOB_ID_PATTERNS.forEach((pattern, index) => {
        const matches = cleanText.matchAll(pattern);
        for (const match of matches) {
            const jobId = match[1] || match[0];
            if (jobId && jobId.length >= 20) {
                foundIds.add(jobId.trim());
                console.log(`🎯 PADRÃO ${index + 1}: Encontrado "${jobId}"`);
            }
        }
    });

    const result = Array.from(foundIds);
    console.log(`⚡ RESULTADO: ${result.length} JobIds únicos extraídos`);
    return result;
}

// INICIALIZAÇÃO ULTRA RÁPIDA do Bot Discord
async function initializeDiscordBot() {
    if (!DISCORD_CONFIG.TOKEN) {
        console.log('❌ DISCORD_BOT_TOKEN não configurado');
        return false;
    }

    try {
        discordBot = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        discordBot.on('ready', () => {
            console.log(`🤖 Bot Discord conectado: ${discordBot.user.tag}`);
            botStats.botStatus = 'Connected';
            botStats.lastActivity = new Date().toISOString();
            
            // Log dos servidores e canais para debug
            console.log('🏠 SERVIDORES CONECTADOS:');
            discordBot.guilds.cache.forEach(guild => {
                console.log(`   - ${guild.name} (${guild.id})`);
                console.log(`     Canais: ${guild.channels.cache.size}`);
            });
            
            const targetChannel = DISCORD_CONFIG.CHANNEL_ID;
            if (targetChannel) {
                console.log(`🎯 Canal alvo: ${targetChannel}`);
            } else {
                console.log('🌐 Canal monitorado: TODOS os canais');
            }
            
            console.log('='.repeat(50));
        });

        // PROCESSAMENTO INSTANTÂNEO de mensagens - SEM FILTROS
        discordBot.on('messageCreate', async (message) => {
            console.log(`⚡ MENSAGEM RECEBIDA:`);
            console.log(`   Canal: ${message.channel.name} (${message.channel.id})`);
            console.log(`   Autor: ${message.author.username} (Bot: ${message.author.bot})`);
            console.log(`   Tamanho: ${message.content.length} chars`);
            console.log(`   Conteúdo: "${message.content}"`);

            // Verifica canal específico (se configurado)
            if (DISCORD_CONFIG.CHANNEL_ID && message.channel.id !== DISCORD_CONFIG.CHANNEL_ID) {
                console.log(`⏭️ Pulando: canal diferente do alvo (${DISCORD_CONFIG.CHANNEL_ID})`);
                return;
            }

            // PROCESSA ABSOLUTAMENTE TODAS AS MENSAGENS - sem exceções
            console.log(`✅ PROCESSANDO TODAS AS MENSAGENS - ZERO FILTROS!`);

            // Verifica se tem conteúdo válido (qualquer conteúdo)
            if (!message.content) {
                console.log(`⚠️ Mensagem sem conteúdo de texto - pulando`);
                return;
            }

            console.log(`✅ PROCESSANDO MENSAGEM...`);
            console.log(`Conteúdo (100 primeiros chars): "${message.content.substring(0, 100)}..."`);

            // EXTRAÇÃO INSTANTÂNEA
            const jobIds = extractJobIds(message.content);
            
            botStats.messagesProcessed++;

            if (jobIds.length > 0) {
                console.log(`🎯 ENCONTRADOS ${jobIds.length} JobIds:`);
                jobIds.forEach((id, index) => {
                    console.log(`   ${index + 1}: ${id}`);
                });

                const added = addNewJobIds(jobIds);
                
                // Reação instantânea
                try {
                    if (added > 0) {
                        await message.react('🎯'); // JobIds novos
                    } else {
                        await message.react('✅'); // JobIds já conhecidos
                    }
                    console.log(`🎭 Reação adicionada à mensagem`);
                } catch (error) {
                    console.log(`⚠️ Erro ao adicionar reação: ${error.message}`);
                }
            } else {
                console.log(`📭 Nenhum JobId encontrado na mensagem`);
            }
        });

        discordBot.on('error', (error) => {
            console.log('❌ Erro no bot Discord:', error);
            botStats.botStatus = 'Error';
        });

        await discordBot.login(DISCORD_CONFIG.TOKEN);
        return true;
    } catch (error) {
        console.log('❌ Erro ao inicializar bot Discord:', error);
        return false;
    }
}

// ENDPOINTS ULTRA RÁPIDOS

// Health check básico
app.get('/health', (req, res) => {
    res.json({
        status: 'ULTRA FAST MODE',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        stats: botStats
    });
});

// Endpoint principal - JobIds frescos
app.get('/pets', (req, res) => {
    res.json(pets.filter(p => p.fresh));
});

// NOVO: Endpoint ULTRA RÁPIDO - apenas os mais frescos
app.get('/pets/fresh', (req, res) => {
    const freshPets = pets.filter(p => p.fresh && p.source === 'discord');
    const freshJobIds = freshPets.flatMap(p => p.job_ids);
    
    res.json({
        fresh_job_ids: freshJobIds.slice(0, 5), // Apenas os 5 mais frescos
        total_fresh: freshJobIds.length,
        last_update: botStats.lastActivity,
        timestamp: Date.now() // Para cache busting
    });
});

// Status do bot
app.get('/bot/status', (req, res) => {
    res.json({
        discord: {
            status: botStats.botStatus,
            connected: discordBot ? discordBot.isReady() : false,
            username: discordBot ? discordBot.user?.tag : 'N/A',
            messages_processed: botStats.messagesProcessed,
            jobids_found: botStats.jobIdsFound,
            last_activity: botStats.lastActivity,
            channel_target: DISCORD_CONFIG.CHANNEL_ID || 'ALL'
        },
        api: {
            pets_count: pets.length,
            total_jobids: pets.reduce((sum, p) => sum + p.job_ids.length, 0),
            uptime: Math.floor(process.uptime())
        }
    });
});

// Teste manual de extração
app.post('/bot/test', (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Texto obrigatório' });
    }

    const foundJobIds = extractJobIds(text);
    const newAdded = addNewJobIds(foundJobIds, 'manual-test');

    res.json({
        found_jobids: foundJobIds,
        new_jobids_added: newAdded,
        total_in_system: pets.reduce((sum, p) => sum + p.job_ids.length, 0),
        message: `Encontrados ${foundJobIds.length} JobIds, ${newAdded} novos adicionados`
    });
});

// Adicionar JobIds manualmente (para testes)
app.post('/pets', (req, res) => {
    const { job_ids } = req.body;
    
    if (!job_ids || !Array.isArray(job_ids)) {
        return res.status(400).json({ error: 'job_ids deve ser um array' });
    }

    const added = addNewJobIds(job_ids, 'manual');
    res.json({
        message: `${added} JobIds adicionados`,
        total: pets.reduce((sum, p) => sum + p.job_ids.length, 0)
    });
});

// INICIALIZAÇÃO ULTRA RÁPIDA
async function startServer() {
    console.log('🚀 Iniciando servidor ULTRA RÁPIDO...');
    console.log('📡 Configuração anti-cache ativada');
    console.log('⚡ Modo sem filtros de duplicata ativado');
    
    // Inicializa bot Discord
    console.log('🤖 Inicializando bot Discord...');
    const discordSuccess = await initializeDiscordBot();
    
    if (discordSuccess) {
        console.log('✅ Bot Discord inicializado com sucesso');
    } else {
        console.log('⚠️ Bot Discord não inicializado - verifique DISCORD_BOT_TOKEN');
    }
    
    // Inicializa servidor
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📡 API disponível em: http://localhost:${PORT}`);
        console.log('='.repeat(50));
        console.log('=== CONFIGURAÇÃO ULTRA RÁPIDA ===');
        console.log(`Canal monitorado: ${DISCORD_CONFIG.CHANNEL_ID || 'TODOS os canais'}`);
        console.log(`Place ID: ${DISCORD_CONFIG.PLACE_ID}`);
        console.log(`Padrões de detecção: ${DISCORD_CONFIG.JOB_ID_PATTERNS.length}`);
        console.log('='.repeat(50));
        
        // Log de heartbeat a cada 30 segundos
        setInterval(() => {
            console.log(`💓 Sistema ativo - JobIds coletados: ${botStats.jobIdsFound}`);
        }, 30000);
    });
}

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.log('❌ Erro não tratado:', error);
});

process.on('unhandledRejection', (reason) => {
    console.log('❌ Promise rejeitada:', reason);
});

startServer();
