// server.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let petsData = []; // Lista dinâmica

// GET /pets - retorna os job_ids
app.get('/pets', (req, res) => {
    res.json(petsData);
});

// POST /pets - adiciona novo job_id
app.post('/pets', (req, res) => {
    const { name, job_ids } = req.body;

    if (!name || !Array.isArray(job_ids)) {
        return res.status(400).json({ error: 'Formato inválido. Esperado: { name, job_ids[] }' });
    }

    petsData.push({ name, job_ids });
    res.status(201).json({ message: 'Job ID adicionado com sucesso' });
});

// GET /test - keep alive
app.get('/test', (req, res) => {
    res.send('API Online');
});

app.listen(PORT, () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
});
