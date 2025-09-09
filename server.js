// server.js
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Banco de dados em memória
let pets = [];

// Rota de teste (keep-alive)
app.get("/test", (req, res) => {
  res.json({ ok: true, msg: "Servidor ativo 🚀" });
});

// Listar todos os pets/job_ids
app.get("/pets", (req, res) => {
  res.json(pets);
});

// Adicionar novos JobIds (sem duplicar)
app.post("/pets", (req, res) => {
  const { name, job_ids } = req.body;

  if (!job_ids || !Array.isArray(job_ids)) {
    return res.status(400).json({ error: "job_ids deve ser um array" });
  }

  // Filtrar somente os job_ids ainda não cadastrados
  const novosJobIds = job_ids.filter(jobId => {
    return !pets.some(pet => pet.job_ids.includes(jobId));
  });

  if (novosJobIds.length === 0) {
    return res.json({ ok: false, msg: "Nenhum JobId novo foi adicionado" });
  }

  const newPet = {
    id: pets.length + 1,
    name: name || `Pet #${pets.length + 1}`,
    job_ids: novosJobIds
  };

  pets.push(newPet);

  console.log("📥 Novos JobIds recebidos:", novosJobIds);
  res.json({ ok: true, added: newPet });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ API rodando na porta ${PORT}`);
});
