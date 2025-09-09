// server.js
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Porta do Render ou local
const PORT = process.env.PORT || 3000;

// Rota de teste (keep-alive)
app.get("/test", (req, res) => {
  res.json({ ok: true, msg: "Servidor ativo 🚀" });
});

// Rota principal de pets
app.get("/pets", (req, res) => {
  // Exemplo de dados retornados
  // Aqui você pode colocar os JobIds capturados de outro lugar
  const data = [
    {
      id: 1,
      name: "Pet Alpha",
      job_ids: ["abc123", "def456"]
    },
    {
      id: 2,
      name: "Pet Beta",
      job_ids: ["ghi789"]
    }
  ];

  res.json(data);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ API rodando na porta ${PORT}`);
});
