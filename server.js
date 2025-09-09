const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');
const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// === CONFIGURAÇÕES ===
const DISCORD_CONFIG = {
    TOKEN: process.env.DISCORD_BOT_TOKEN || '', // Token do bot Discord
    CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || '', // ID do canal para monitorar
    PLACE_ID: process.env.PLACE_ID || '109983668079237',
    JOB_ID_PATTERNS: [
        /JobId[:\s]*([a-f0-9\-]{8,36})/gi,
        /Server[:\s]*([a-f0-9\-]{8,36})/gi,
        /ID[:\s]*([a-f0-9\-]{8,36})/gi,
        /Job[:\s]*([a-f0-9\-]{8,36})/gi,
        /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi, // UUID format
        /([a-f0-9]{32})/gi // 32 char hex
    ]
};

// Armazenamento
let pets = [
    {
        id: 1,
        name: "Discord Auto-Detected",
        rarity: "Discord",
        job_ids: [],
        timestamp: new Date().toISOString(),
        auto_generated: true,
        source: "discord"
    }
];
let nextId = 2;
let knownJobIds = new Set();
let discordBot = null;
let botStats = {
    messagesProcessed: 0,
    jobIdsFound: 0,
    lastActivity: null,
    botStatus: 'Disconnected'
};

// === FUNÇÕES UTILITÁRIAS ===

function extractJobIds(text) {
    const foundIds = new Set();
    
    DISCORD_CONFIG.JOB_ID_PATTERNS.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const id = match[1] || match[0];
            if (id && id.length >= 8) {
                foundIds.add(id.trim());
            }
        }
    });
    
    return Array.from(foundIds);
}

function addNewJobIds(newJobIds, source = 'discord') {
    if (newJobIds.length === 0) return 0;
    
    // Filtra apenas IDs realmente novos
    const trulyNewIds = newJobIds.filter(id => !knownJobIds.has(id));
    if (trulyNewIds.length === 0) return 0;
    
    // Encontra ou cria pet para armazenar
    let discordPet = pets.find(p => p.source === source);
    if (!discordPet) {
        discordPet = {
            id: nextId++,
            name: `${source.charAt(0).toUpperCase() + source.slice(1)} Auto-Detected`,
            rarity: "Auto",
            job_ids: [],
            timestamp: new Date().toISOString(),
            auto_generated: true,
            source: source
        };
        pets.push(discordPet);
    }
    
    // Adiciona novos JobIds
    discordPet.job_ids = [...(discordPet.job_ids || []), ...trulyNewIds];
    discordPet.timestamp = new Date().toISOString();
    
    // Marca como conhecidos
    trulyNewIds.forEach(id => knownJobIds.add(id));
    
    // Mantém apenas os 50 mais recentes
    if (discordPet.job_ids.length > 50) {
        discordPet.job_ids = discordPet.job_ids.slice(-50);
    }
    
    console.log(`✅ Discord: Adicionados ${trulyNewIds.length} novos JobIds`);
    botStats.jobIdsFound += trulyNewIds.length;
    
    return trulyNewIds.length;
}

// === BOT DISCORD ===

async function initializeDiscordBot() {
    if (!DISCORD_CONFIG.TOKEN) {
        console.log('⚠️ DISCORD_BOT_TOKEN não configurado');
        return false;
    }
    
    try {
        discordBot = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
        
        discordBot.on('ready', () => {
            console.log(`🤖 Bot Discord conectado: ${discordBot.user.tag}`);
            botStats.botStatus = 'Connected';
            botStats.lastActivity = new Date().toISOString();
        });
        
        discordBot.on('messageCreate', async (message) => {
            // Ignora bots e mensagens sem conteúdo
            if (message.author.bot || !message.content) return;
            
            // Verifica se é do canal correto (se especificado)
            if (DISCORD_CONFIG.CHANNEL_ID && message.channel.id !== DISCORD_CONFIG.CHANNEL_ID) {
                return;
            }
            
            botStats.messagesProcessed++;
            botStats.lastActivity = new Date().toISOString();
            
            // Log da mensagem recebida (para debug)
            console.log(`📨 Nova mensagem de ${message.author.username}: ${message.content.substring(0, 100)}...`);
            
            // Extrai JobIds da mensagem
            const jobIds = extractJobIds(message.content);
            
            if (jobIds.length > 0) {
                console.log(`🔍 Discord: Encontrados JobIds na mensagem de ${message.author.username}:`);
                jobIds.forEach(id => console.log(`   → ${id}`));
                
                const added = addNewJobIds(jobIds, 'discord');
                
                if (added > 0) {
                    console.log(`✅ ${added} novos JobIds adicionados à API`);
                    
                    // Reage à mensagem com sucesso
                    try {
                        await message.react('🎯');
                    } catch (error) {
                        console.log('Não foi possível reagir à mensagem');
                    }
                } else {
                    console.log(`ℹ️ JobIds já conhecidos, nenhum adicionado`);
                    
                    // Reage com check para mostrar que foi processado
                    try {
                        await message.react('✅');
                    } catch (error) {
                        console.log('Não foi possível reagir à mensagem');
                    }
                }
            }
        });
        
        discordBot.on('error', (error) => {
            console.error('❌ Erro no bot Discord:', error);
            botStats.botStatus = 'Error';
        });
        
        discordBot.on('disconnect', () => {
            console.log('🔌 Bot Discord desconectado');
            botStats.botStatus = 'Disconnected';
        });
        
        await discordBot.login(DISCORD_CONFIG.TOKEN);
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao inicializar bot Discord:', error.message);
        botStats.botStatus = 'Error';
        return false;
    }
}

// Inicializa conhecimento de JobIds existentes
function initializeKnownJobIds() {
    pets.forEach(pet => {
        if (pet.job_ids) {
            pet.job_ids.forEach(jobId => knownJobIds.add(jobId));
        }
    });
}

// === ROTAS DA API ===

// Endpoint ULTRA RÁPIDO para JobIds frescos
app.get('/pets/fresh', (req, res) => {
    try {
        // Retorna APENAS os pets mais frescos (sem cache)
        const freshPets = pets.filter(p => p.fresh || p.source === 'discord')
                              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                              .slice(0, 3); // Só os 3 mais recentes
        
        // Headers para ZERO cache
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.json(freshPets);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar pets frescos' });
    }
});

app.get('/pets/:id', (req, res) => {
    try {
        const pet = pets.find(p => p.id === parseInt(req.params.id));
        if (!pet) {
            return res.status(404).json({ error: 'Pet não encontrado' });
        }
        res.json(pet);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar pet' });
    }
});

app.post('/pets', (req, res) => {
    try {
        const { name, rarity, job_ids } = req.body;
        
        if (!name || !rarity || !job_ids || !Array.isArray(job_ids)) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: name, rarity, job_ids (array)' 
            });
        }

        const newPet = {
            id: nextId++,
            name,
            rarity,
            job_ids,
            timestamp: new Date().toISOString(),
            auto_generated: false,
            source: 'manual'
        };

        // Adiciona à lista de JobIds conhecidos
        job_ids.forEach(jobId => knownJobIds.add(jobId));

        pets.push(newPet);
        res.status(201).json(newPet);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar pet' });
    }
});

app.post('/pets/:id/jobids', (req, res) => {
    try {
        const petIndex = pets.findIndex(p => p.id === parseInt(req.params.id));
        if (petIndex === -1) {
            return res.status(404).json({ error: 'Pet não encontrado' });
        }

        const { job_ids } = req.body;
        if (!job_ids || !Array.isArray(job_ids)) {
            return res.status(400).json({ error: 'job_ids deve ser um array' });
        }

        const currentJobIds = pets[petIndex].job_ids || [];
        const newJobIds = [...new Set([...currentJobIds, ...job_ids])];
        
        // Adiciona à lista de conhecidos
        job_ids.forEach(jobId => knownJobIds.add(jobId));
        
        pets[petIndex].job_ids = newJobIds;
        pets[petIndex].timestamp = new Date().toISOString();

        res.json(pets[petIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao adicionar JobIds' });
    }
});

// === ROTAS DO BOT DISCORD ===

app.get('/bot/status', (req, res) => {
    res.json({
        discord: {
            status: botStats.botStatus,
            connected: discordBot?.isReady() || false,
            username: discordBot?.user?.tag || 'N/A',
            channel_id: DISCORD_CONFIG.CHANNEL_ID,
            messages_processed: botStats.messagesProcessed,
            jobids_found: botStats.jobIdsFound,
            last_activity: botStats.lastActivity
        },
        api: {
            known_jobids_count: knownJobIds.size,
            pets_count: pets.length,
            place_id: DISCORD_CONFIG.PLACE_ID
        }
    });
});

app.post('/bot/restart', async (req, res) => {
    try {
        if (discordBot) {
            discordBot.destroy();
        }
        
        botStats.botStatus = 'Restarting';
        const success = await initializeDiscordBot();
        
        res.json({
            success,
            message: success ? 'Bot reiniciado com sucesso' : 'Erro ao reiniciar bot'
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao reiniciar bot' });
    }
});

app.put('/bot/config', (req, res) => {
    const { channel_id, place_id } = req.body;
    
    if (channel_id) DISCORD_CONFIG.CHANNEL_ID = channel_id;
    if (place_id) DISCORD_CONFIG.PLACE_ID = place_id;
    
    res.json({ 
        message: 'Configuração atualizada',
        config: {
            channel_id: DISCORD_CONFIG.CHANNEL_ID,
            place_id: DISCORD_CONFIG.PLACE_ID
        }
    });
});

app.post('/bot/test', (req, res) => {
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Campo text é obrigatório' });
    }
    
    const jobIds = extractJobIds(text);
    const added = addNewJobIds(jobIds, 'test');
    
    res.json({
        text,
        found_jobids: jobIds,
        new_jobids_added: added,
        message: `Encontrados ${jobIds.length} JobIds, ${added} novos adicionados`
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        api: {
            pets_count: pets.length,
            known_jobids: knownJobIds.size
        },
        discord_bot: {
            status: botStats.botStatus,
            connected: discordBot?.isReady() || false,
            messages_processed: botStats.messagesProcessed,
            jobids_found: botStats.jobIdsFound
        }
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'AutoJoin Backend API com Bot Discord',
        version: '3.0.0',
        discord_bot_status: botStats.botStatus,
        endpoints: {
            'GET /pets': 'Lista todos os pets',
            'GET /pets/:id': 'Busca pet por ID',
            'POST /pets': 'Cria novo pet',
            'POST /pets/:id/jobids': 'Adiciona JobIds ao pet',
            'GET /bot/status': 'Status do bot Discord',
            'POST /bot/restart': 'Reinicia bot Discord',
            'PUT /bot/config': 'Atualiza configuração',
            'POST /bot/test': 'Testa extração de JobIds',
            'GET /health': 'Status geral'
        },
        setup_instructions: {
            step1: 'Configure DISCORD_BOT_TOKEN nas variáveis de ambiente',
            step2: 'Configure DISCORD_CHANNEL_ID (opcional - se não configurar, monitora todos os canais)',
            step3: 'O bot detectará automaticamente JobIds nas mensagens'
        }
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// === INICIALIZAÇÃO ===

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 API disponível em: http://localhost:${PORT}`);
    
    // Inicializa JobIds conhecidos
    initializeKnownJobIds();
    
    // Inicializa bot Discord
    console.log('🤖 Inicializando bot Discord...');
    const discordSuccess = await initializeDiscordBot();
    
    if (discordSuccess) {
        console.log('✅ Bot Discord inicializado com sucesso');
        
        // Heartbeat para mostrar que está vivo
        setInterval(() => {
            console.log(`💓 Bot heartbeat: ${new Date().toLocaleTimeString()} - Mensagens processadas: ${botStats.messagesProcessed}`);
        }, 60000); // A cada 1 minuto
        
    } else {
        console.log('❌ Bot Discord não pôde ser inicializado - verifique o token');
    }
    
    console.log('\n=== CONFIGURAÇÃO ===');
    console.log(`Canal monitorado: ${DISCORD_CONFIG.CHANNEL_ID || 'TODOS os canais'}`);
    console.log(`Place ID: ${DISCORD_CONFIG.PLACE_ID}`);
    console.log('====================\n');
});

module.exports = app;
