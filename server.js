const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurações
let config = {
  enabled: true,
  autojoinApiUrl: 'https://autojoin-api.onrender.com/pets',
  monitorInterval: 5000, // 5 segundos
  filters: {
    minMoneyPerSec: 25, // Mínimo $25M/s
    maxPlayers: 8, // Máximo 8 players
    keywords: ['Grande', 'Combinasion', 'Pet', 'Huge'] // Palavras-chave para filtrar
  },
  notifications: [],
  stats: {
    totalNotifications: 0,
    autojoinsAttempted: 0,
    successfulJoins: 0
  }
};

const CONFIG_FILE = path.join(__dirname, 'brainrot_config.json');

// Carregar configurações
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    config = { ...config, ...JSON.parse(data) };
    console.log('✅ Configurações carregadas');
  } catch (error) {
    console.log('⚙️ Usando configurações padrão');
  }
}

// Salvar configurações
async function saveConfig() {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('❌ Erro ao salvar configurações:', error);
  }
}

// Extrair valor monetário da string (ex: "$30M/s" -> 30)
function parseMoneyValue(moneyStr) {
  if (!moneyStr) return 0;
  const match = moneyStr.match(/\$(\d+(?:\.\d+)?)([KMB])/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  switch(unit) {
    case 'k': return value;
    case 'm': return value * 1000;
    case 'b': return value * 1000000;
    default: return value;
  }
}

// Verificar se a notificação atende aos filtros
function shouldAutojoin(notification) {
  const { filters } = config;
  
  // Verificar dinheiro por segundo
  const moneyValue = parseMoneyValue(notification.moneyPerSec);
  if (moneyValue < filters.minMoneyPerSec) return false;
  
  // Verificar número de players
  if (notification.players) {
    const [current] = notification.players.split('/').map(n => parseInt(n));
    if (current >= filters.maxPlayers) return false;
  }
  
  // Verificar palavras-chave no nome
  if (filters.keywords.length > 0) {
    const nameMatch = filters.keywords.some(keyword => 
      notification.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (!nameMatch) return false;
  }
  
  return true;
}

// Executar autojoin usando a API
async function executeAutojoin(jobId, platform = 'mobile') {
  try {
    console.log(`🤖 Tentando autojoin: ${jobId} (${platform})`);
    
    const response = await axios.post(config.autojoinApiUrl, {
      jobId: jobId,
      platform: platform
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BrainrotMonitor/1.0'
      }
    });

    config.stats.successfulJoins++;
    await saveConfig();
    
    console.log(`✅ Autojoin executado com sucesso: ${jobId}`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ Erro no autojoin ${jobId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Simular captura de notificação do Brainrot Notify
function simulateNotification() {
  const notifications = [
    {
      name: "La Grande Combinasion",
      moneyPerSec: "$30M/s",
      players: "6/8",
      jobIds: {
        mobile: "91RA2DNRtfkIGH2K4NOL48FNGjappgxqBHwsfOwQYtxL2DFVT4NDXWNWZINqtD0DaOGirkSKDplUBbtE7HElDE1TCEuLHbuQ",
        ios: "91RA2DNRtfkIGH2K4NOL48FNGjappgxqBHwsfOwQYtxL2DFVT4NDXWNWZINqtD0DaOGirkSKDplUBbtE7HElDE1TCEuLHbuQ",
        pc: "91RA2DNRtfkIGH2K4NOL48FNGjappgxqBHwsfOwQYtxL2DFVT4NDXWNWZINqtD0DaOGirkSKDplUBbtE7HElDE1TCEuLHbuQ"
      },
      timestamp: new Date().toISOString()
    }
  ];
  
  return notifications[Math.floor(Math.random() * notifications.length)];
}

// Processar notificação recebida
async function processNotification(notification) {
  console.log(`📨 Nova notificação: ${notification.name} - ${notification.moneyPerSec} - ${notification.players}`);
  
  // Adicionar à lista de notificações
  config.notifications.unshift({
    ...notification,
    id: Date.now().toString(),
    processed: false
  });
  
  // Manter apenas as últimas 50 notificações
  if (config.notifications.length > 50) {
    config.notifications = config.notifications.slice(0, 50);
  }
  
  config.stats.totalNotifications++;
  
  // Verificar se deve fazer autojoin
  if (shouldAutojoin(notification)) {
    console.log(`🎯 Notificação atende aos critérios! Executando autojoin...`);
    
    config.stats.autojoinsAttempted++;
    
    // Tentar autojoin em todas as plataformas disponíveis
    const results = [];
    for (const [platform, jobId] of Object.entries(notification.jobIds)) {
      if (jobId) {
        const result = await executeAutojoin(jobId, platform);
        results.push({ platform, ...result });
        
        if (result.success) break; // Se um deu certo, para
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1s entre tentativas
      }
    }
    
    // Marcar notificação como processada
    const notificationIndex = config.notifications.findIndex(n => n.id === notification.id);
    if (notificationIndex !== -1) {
      config.notifications[notificationIndex].processed = true;
      config.notifications[notificationIndex].autojoinResults = results;
    }
  }
  
  await saveConfig();
}

// Monitor simulado (você deve substituir por captura real)
let monitorInterval;

function startMonitoring() {
  if (monitorInterval) return;
  
  console.log('🔍 Iniciando monitoramento...');
  
  monitorInterval = setInterval(() => {
    if (config.enabled) {
      // Simular recebimento de notificação (substitua por captura real)
      if (Math.random() < 0.1) { // 10% de chance por verificação
        const notification = simulateNotification();
        processNotification(notification);
      }
    }
  }, config.monitorInterval);
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('⏹️ Monitoramento parado');
  }
}

// Rotas da API

// Status do sistema
app.get('/api/status', (req, res) => {
  res.json({
    enabled: config.enabled,
    monitoring: !!monitorInterval,
    stats: config.stats,
    uptime: process.uptime(),
    lastNotification: config.notifications[0] || null
  });
});

// Configurações
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Atualizar configurações
app.put('/api/config', (req, res) => {
  Object.assign(config, req.body);
  saveConfig();
  res.json({ message: 'Configurações atualizadas', config });
});

// Listar notificações
app.get('/api/notifications', (req, res) => {
  const { limit = 20, processed } = req.query;
  let notifications = config.notifications;
  
  if (processed !== undefined) {
    notifications = notifications.filter(n => n.processed === (processed === 'true'));
  }
  
  res.json(notifications.slice(0, parseInt(limit)));
});

// Controlar monitoramento
app.post('/api/monitor/toggle', (req, res) => {
  config.enabled = !config.enabled;
  
  if (config.enabled) {
    startMonitoring();
  } else {
    stopMonitoring();
  }
  
  saveConfig();
  res.json({ 
    message: `Monitoramento ${config.enabled ? 'ativado' : 'desativado'}`,
    enabled: config.enabled 
  });
});

// Testar conectividade da API
app.get('/api/test-endpoints', async (req, res) => {
  const endpoints = [
    'https://autojoin-api.onrender.com/pets',
    'https://autojoin-api.onrender.com/pet',
    'https://autojoin-api.onrender.com/autojoin',
    'https://autojoin-api.onrender.com/join',
    'https://autojoin-api.onrender.com/'
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      // Testar GET
      try {
        const getResponse = await axios.get(endpoint, { timeout: 5000 });
        results.push({ endpoint, method: 'GET', status: getResponse.status, success: true });
      } catch (getError) {
        results.push({ 
          endpoint, 
          method: 'GET', 
          status: getError.response?.status || 0, 
          success: false,
          error: getError.message 
        });
      }
      
      // Testar POST
      try {
        const postResponse = await axios.post(endpoint, { test: true }, { 
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });
        results.push({ endpoint, method: 'POST', status: postResponse.status, success: true });
      } catch (postError) {
        results.push({ 
          endpoint, 
          method: 'POST', 
          status: postError.response?.status || 0, 
          success: false,
          error: postError.message 
        });
      }
    } catch (error) {
      results.push({ endpoint, method: 'BOTH', success: false, error: error.message });
    }
  }
  
  res.json({ results });
});
app.post('/api/autojoin/manual', async (req, res) => {
  const { jobId, platform = 'mobile' } = req.body;
  
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID é obrigatório' });
  }
  
  const result = await executeAutojoin(jobId, platform);
  res.json(result);
});

// Simular notificação para teste
app.post('/api/test/notification', async (req, res) => {
  const notification = req.body.notification || simulateNotification();
  await processNotification(notification);
  res.json({ message: 'Notificação de teste processada', notification });
});

// Limpar notificações
app.delete('/api/notifications', (req, res) => {
  config.notifications = [];
  config.stats = {
    totalNotifications: 0,
    autojoinsAttempted: 0,
    successfulJoins: 0
  };
  saveConfig();
  res.json({ message: 'Notificações limpas' });
});

// Interface web
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Brainrot Notify Monitor</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
            .container { max-width: 1200px; margin: 0 auto; }
            .status { background: #2d2d2d; padding: 15px; border-radius: 8px; margin: 10px 0; }
            .notification { background: #333; padding: 10px; margin: 5px 0; border-radius: 5px; }
            .success { color: #4CAF50; }
            .error { color: #f44336; }
            .warning { color: #ff9800; }
            button { background: #007bff; color: white; border: none; padding: 10px 15px; margin: 5px; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .stats { display: flex; gap: 20px; }
            .stat-box { background: #2d2d2d; padding: 15px; border-radius: 8px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 Brainrot Notify Monitor</h1>
            
            <div class="status" id="status">
                <h3>Status: <span id="statusText">Carregando...</span></h3>
                <button onclick="toggleMonitor()">Toggle Monitor</button>
                <button onclick="testNotification()">Testar Notificação</button>
                <button onclick="clearNotifications()">Limpar Dados</button>
            </div>
            
            <div class="stats" id="stats">
                <div class="stat-box">
                    <h4>Total Job IDs</h4>
                    <span id="totalNotifications">0</span>
                </div>
                <div class="stat-box">
                    <h4>Autojoins Executados</h4>
                    <span id="autojoinsAttempted">0</span>
                </div>
                <div class="stat-box">
                    <h4>Sucessos</h4>
                    <span id="successfulJoins">0</span>
                </div>
            </div>
            
            <h3>Últimos Job IDs Capturados</h3>
            <div id="notifications"></div>
        </div>

        <script>
            let statusData = {};
            
            async function updateStatus() {
                try {
                    const response = await fetch('/api/status');
                    statusData = await response.json();
                    
                    document.getElementById('statusText').textContent = 
                        statusData.enabled ? 'ATIVO' : 'INATIVO';
                    document.getElementById('statusText').className = 
                        statusData.enabled ? 'success' : 'error';
                    
                    document.getElementById('totalNotifications').textContent = statusData.stats.totalNotifications;
                    document.getElementById('autojoinsAttempted').textContent = statusData.stats.autojoinsAttempted;
                    document.getElementById('successfulJoins').textContent = statusData.stats.successfulJoins;
                    
                } catch (error) {
                    console.error('Erro ao atualizar status:', error);
                }
            }
            
            async function updateNotifications() {
                try {
                    const response = await fetch('/api/notifications?limit=10');
                    const notifications = await response.json();
                    
                    const container = document.getElementById('notifications');
                    container.innerHTML = '';
                    
                    notifications.forEach(notification => {
                        const div = document.createElement('div');
                        div.className = 'notification';
                        div.innerHTML = \`
                            <strong>\${notification.name}</strong> - 
                            \${notification.moneyPerSec} - 
                            \${notification.players} players
                            <br>
                            <small>
                                \${new Date(notification.timestamp).toLocaleString()} - 
                                \${notification.processed ? '<span class="success">Processado</span>' : '<span class="warning">Pendente</span>'}
                            </small>
                        \`;
                        container.appendChild(div);
                    });
                    
                } catch (error) {
                    console.error('Erro ao atualizar notificações:', error);
                }
            }
            
            async function toggleMonitor() {
                try {
                    await fetch('/api/monitor/toggle', { method: 'POST' });
                    updateStatus();
                } catch (error) {
                    console.error('Erro ao alternar monitor:', error);
                }
            }
            
            async function testNotification() {
                try {
                    await fetch('/api/test/notification', { method: 'POST' });
                    setTimeout(() => {
                        updateStatus();
                        updateNotifications();
                    }, 1000);
                } catch (error) {
                    console.error('Erro ao testar notificação:', error);
                }
            }
            
            async function clearNotifications() {
                if (confirm('Limpar todas as notificações e estatísticas?')) {
                    try {
                        await fetch('/api/notifications', { method: 'DELETE' });
                        updateStatus();
                        updateNotifications();
                    } catch (error) {
                        console.error('Erro ao limpar notificações:', error);
                    }
                }
            }
            
            // Atualizar a cada 5 segundos
            setInterval(() => {
                updateStatus();
                updateNotifications();
            }, 5000);
            
            // Carregar dados iniciais
            updateStatus();
            updateNotifications();
        </script>
    </body>
    </html>
  `);
});

// Inicializar servidor
async function startServer() {
  await loadConfig();
  
  app.listen(PORT, () => {
    console.log(`🚀 Brainrot Monitor rodando na porta ${PORT}`);
    console.log(`📊 Acesse http://localhost:${PORT} para ver o painel`);
    console.log(`🎯 API Autojoin: ${config.autojoinApiUrl}`);
    
    if (config.enabled) {
      startMonitoring();
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Parando servidor...');
  stopMonitoring();
  saveConfig().then(() => {
    process.exit(0);
  });
});

startServer().catch(console.error);
