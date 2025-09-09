// server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// URL da API de autojoin
const AUTOJOIN_API_URL = "https://autojoin-api.onrender.com/pets";

// Rota para buscar jobIds direto da API (sem cache local)
app.get("/pets", async (req, res) => {
  try {
    const response = await axios.get(AUTOJOIN_API_URL);
    return res.json(response.data);
  } catch (err) {
    console.error("❌ Erro ao buscar pets:", err.message);
    return res.status(500).json({ error: "Erro ao buscar pets" });
  }
});

// Rota de teste (só pra saber se o servidor está rodando)
app.get("/test", (req, res) => {
  res.json({ status: "ok", message: "Servidor funcionando 🚀" });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
