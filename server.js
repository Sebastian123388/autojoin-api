const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let pets = [
    {
        name: "Pet 1",
        job_ids: ["1234567890abcdef1234567890abcdef"]
    },
    {
        name: "Pet 2",
        job_ids: ["abcdefabcdefabcdefabcdefabcdefab"]
    }
];

// [GET] Retorna os pets com job_ids
app.get('/pets', (req, res) => {
    res.json(pets);
});

// [POST] Adiciona um novo pet (opcional)
app.post('/pets', (req, res) => {
    const pet = req.body;
    if (!pet || !pet.job_ids || !Array.isArray(pet.job_ids)) {
        return res.status(400).json({ error: "Pet inválido" });
    }
    pets.push(pet);
    res.json({ status: "Pet adicionado com sucesso!" });
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
