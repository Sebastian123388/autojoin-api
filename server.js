const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors({
    origin: '*', // Permite todas as origens (necessário para Roblox)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Armazenamento em memória (em produção, use um banco de dados)
let pets = [
    {
        id: 1,
        name: "Golden Dragon",
        rarity: "Legendary",
        job_ids: ["12345678", "87654321"],
        timestamp: new Date().toISOString()
    },
    {
        id: 2,
        name: "Diamond Cat", 
        rarity: "Epic",
        job_ids: ["11111111", "22222222"],
        timestamp: new Date().toISOString()
    }
];

// Contador para IDs únicos
let nextId = 3;

// === ROTAS ===

// GET /pets - Retorna todos os pets
app.get('/pets', (req, res) => {
    try {
        // Ordena por timestamp mais recente primeiro
        const sortedPets = pets.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(sortedPets);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar pets' });
    }
});

// GET /pets/:id - Retorna um pet específico
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

// POST /pets - Adiciona um novo pet
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
            timestamp: new Date().toISOString()
        };

        pets.push(newPet);
        res.status(201).json(newPet);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar pet' });
    }
});

// PUT /pets/:id - Atualiza um pet
app.put('/pets/:id', (req, res) => {
    try {
        const petIndex = pets.findIndex(p => p.id === parseInt(req.params.id));
        if (petIndex === -1) {
            return res.status(404).json({ error: 'Pet não encontrado' });
        }

        const { name, rarity, job_ids } = req.body;
        pets[petIndex] = {
            ...pets[petIndex],
            ...(name && { name }),
            ...(rarity && { rarity }),
            ...(job_ids && { job_ids }),
            timestamp: new Date().toISOString()
        };

        res.json(pets[petIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar pet' });
    }
});

// DELETE /pets/:id - Remove um pet
app.delete('/pets/:id', (req, res) => {
    try {
        const petIndex = pets.findIndex(p => p.id === parseInt(req.params.id));
        if (petIndex === -1) {
            return res.status(404).json({ error: 'Pet não encontrado' });
        }

        pets.splice(petIndex, 1);
        res.json({ message: 'Pet removido com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover pet' });
    }
});

// POST /pets/:id/jobids - Adiciona novos JobIds a um pet
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

        // Remove duplicados e adiciona novos JobIds
        const currentJobIds = pets[petIndex].job_ids || [];
        const newJobIds = [...new Set([...currentJobIds, ...job_ids])];
        
        pets[petIndex].job_ids = newJobIds;
        pets[petIndex].timestamp = new Date().toISOString();

        res.json(pets[petIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao adicionar JobIds' });
    }
});

// GET /health - Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        pets_count: pets.length
    });
});

// GET / - Rota principal com documentação
app.get('/', (req, res) => {
    res.json({
        message: 'AutoJoin Backend API',
        version: '1.0.0',
        endpoints: {
            'GET /pets': 'Lista todos os pets',
            'GET /pets/:id': 'Busca pet por ID',
            'POST /pets': 'Cria novo pet',
            'PUT /pets/:id': 'Atualiza pet',
            'DELETE /pets/:id': 'Remove pet',
            'POST /pets/:id/jobids': 'Adiciona JobIds ao pet',
            'GET /health': 'Status da API'
        }
    });
});

// Middleware de erro 404
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 API disponível em: http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
