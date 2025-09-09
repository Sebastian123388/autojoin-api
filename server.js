-- ⚡ AUTOJOIN ULTRA - SCRIPTERS EDITION ⚡
-- Performance otimizada + GUI moderna + Features avançadas

-- Serviços
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local CoreGui = game:GetService("CoreGui")
local TweenService = game:GetService("TweenService")
local HttpService = game:GetService("HttpService")
local TeleportService = game:GetService("TeleportService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")

-- 🎯 CONFIGURAÇÕES AVANÇADAS
local CONFIG = {
    PLACE_ID = 109983668079237,
    BACKEND_URL = "https://autojojn1-10guizo.onrender.com/pets",
    CHECK_INTERVAL = 0.03, -- Ultra rápido (30ms)
    MAX_RETRIES = 3,
    PREFERRED_PLATFORMS = {"PC", "Mobile", "iOS"}, -- Ordem de preferência
    MIN_PLAYERS = 1, -- Mínimo de players para entrar
    MAX_PLAYERS = 8, -- Máximo de players para entrar
    SOUNDS_ENABLED = true,
    AUTO_RECONNECT = true
}

-- Variáveis globais
local autoJoinEnabled = false
local knownJobIds = {}
local lastJobId = nil
local stats = {
    serversFound = 0,
    serversJoined = 0,
    startTime = tick(),
    lastUpdate = 0,
    apiCalls = 0,
    errors = 0
}

-- 🔊 Sistema de Sons
local function playSound(soundId)
    if not CONFIG.SOUNDS_ENABLED then return end
    pcall(function()
        local sound = Instance.new("Sound")
        sound.SoundId = soundId
        sound.Volume = 0.3
        sound.Parent = SoundService
        sound:Play()
        sound.Ended:Connect(function() sound:Destroy() end)
    end)
end

local SOUNDS = {
    connect = "rbxasset://sounds/electronicpingshort.wav",
    disconnect = "rbxasset://sounds/button-09.mp3",
    serverFound = "rbxasset://sounds/notification.mp3",
    error = "rbxasset://sounds/impact_water.mp3"
}

-- 🎨 GUI ULTRA MODERNA
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "AutoJoinUltra"
screenGui.Parent = CoreGui
screenGui.ResetOnSpawn = false

-- Frame principal com efeitos avançados
local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(0, 420, 0, 280)
mainFrame.Position = UDim2.new(0.5, -210, 0.5, -140)
mainFrame.BackgroundColor3 = Color3.fromRGB(18, 18, 25)
mainFrame.BorderSizePixel = 0
mainFrame.AnchorPoint = Vector2.new(0.5, 0.5)
mainFrame.Parent = screenGui
mainFrame.ClipsDescendants = true

-- Efeito de vidro/blur
local blurFrame = Instance.new("Frame")
blurFrame.Size = UDim2.new(1, 6, 1, 6)
blurFrame.Position = UDim2.new(0, -3, 0, -3)
blurFrame.BackgroundColor3 = Color3.fromRGB(12, 15, 20)
blurFrame.BackgroundTransparency = 0.2
blurFrame.BorderSizePixel = 0
blurFrame.Parent = mainFrame
blurFrame.ZIndex = -2

local blurCorner = Instance.new("UICorner")
blurCorner.CornerRadius = UDim.new(0, 20)
blurCorner.Parent = blurFrame

-- Canto arredondado principal
local mainCorner = Instance.new("UICorner")
mainCorner.CornerRadius = UDim.new(0, 18)
mainCorner.Parent = mainFrame

-- Borda animada RGB
local borderFrame = Instance.new("Frame")
borderFrame.Size = UDim2.new(1, 4, 1, 4)
borderFrame.Position = UDim2.new(0, -2, 0, -2)
borderFrame.BackgroundTransparency = 1
borderFrame.BorderSizePixel = 0
borderFrame.Parent = mainFrame
borderFrame.ZIndex = -1

local borderStroke = Instance.new("UIStroke")
borderStroke.Color = Color3.fromRGB(60, 120, 255)
borderStroke.Thickness = 2
borderStroke.Transparency = 0.3
borderStroke.Parent = mainFrame

-- Gradiente de fundo animado
local gradient = Instance.new("UIGradient")
gradient.Color = ColorSequence.new{
    ColorSequenceKeypoint.new(0, Color3.fromRGB(25, 30, 40)),
    ColorSequenceKeypoint.new(0.5, Color3.fromRGB(18, 18, 25)),
    ColorSequenceKeypoint.new(1, Color3.fromRGB(15, 20, 35))
}
gradient.Rotation = 45
gradient.Parent = mainFrame

-- Header com título elegante
local headerFrame = Instance.new("Frame")
headerFrame.Size = UDim2.new(1, 0, 0, 70)
headerFrame.Position = UDim2.new(0, 0, 0, 0)
headerFrame.BackgroundTransparency = 1
headerFrame.Parent = mainFrame

local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, -80, 0, 35)
titleLabel.Position = UDim2.new(0, 20, 0, 10)
titleLabel.BackgroundTransparency = 1
titleLabel.Text = "⚡ AutoJoin Ultra"
titleLabel.TextColor3 = Color3.fromRGB(220, 240, 255)
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextSize = 28
titleLabel.TextStrokeTransparency = 0.7
titleLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
titleLabel.Parent = headerFrame

local subtitleLabel = Instance.new("TextLabel")
subtitleLabel.Size = UDim2.new(1, -80, 0, 20)
subtitleLabel.Position = UDim2.new(0, 20, 0, 45)
subtitleLabel.BackgroundTransparency = 1
subtitleLabel.Text = "Scripters Premium Edition"
subtitleLabel.TextColor3 = Color3.fromRGB(140, 160, 200)
subtitleLabel.Font = Enum.Font.Gotham
subtitleLabel.TextSize = 14
subtitleLabel.TextTransparency = 0.2
subtitleLabel.Parent = headerFrame

-- Status indicator animado
local statusFrame = Instance.new("Frame")
statusFrame.Size = UDim2.new(0, 45, 0, 45)
statusFrame.Position = UDim2.new(1, -60, 0, 12)
statusFrame.BackgroundTransparency = 1
statusFrame.Parent = headerFrame

local statusCircle = Instance.new("Frame")
statusCircle.Size = UDim2.new(0, 18, 0, 18)
statusCircle.Position = UDim2.new(0.5, -9, 0.5, -9)
statusCircle.BackgroundColor3 = Color3.fromRGB(255, 80, 80)
statusCircle.BorderSizePixel = 0
statusCircle.Parent = statusFrame

local statusCorner = Instance.new("UICorner")
statusCorner.CornerRadius = UDim.new(1, 0)
statusCorner.Parent = statusCircle

local statusGlow = Instance.new("UIStroke")
statusGlow.Color = Color3.fromRGB(255, 80, 80)
statusGlow.Thickness = 3
statusGlow.Transparency = 0.6
statusGlow.Parent = statusCircle

-- Stats Panel
local statsFrame = Instance.new("Frame")
statsFrame.Size = UDim2.new(1, -40, 0, 80)
statsFrame.Position = UDim2.new(0, 20, 0, 80)
statsFrame.BackgroundColor3 = Color3.fromRGB(25, 28, 35)
statsFrame.BackgroundTransparency = 0.3
statsFrame.BorderSizePixel = 0
statsFrame.Parent = mainFrame

local statsCorner = Instance.new("UICorner")
statsCorner.CornerRadius = UDim.new(0, 12)
statsCorner.Parent = statsFrame

-- Grid de stats
local function createStatLabel(text, value, position)
    local statFrame = Instance.new("Frame")
    statFrame.Size = UDim2.new(0.5, -10, 0, 35)
    statFrame.Position = position
    statFrame.BackgroundTransparency = 1
    statFrame.Parent = statsFrame
    
    local statLabel = Instance.new("TextLabel")
    statLabel.Size = UDim2.new(1, 0, 0.6, 0)
    statLabel.Position = UDim2.new(0, 0, 0, 0)
    statLabel.BackgroundTransparency = 1
    statLabel.Text = text
    statLabel.TextColor3 = Color3.fromRGB(160, 180, 220)
    statLabel.Font = Enum.Font.Gotham
    statLabel.TextSize = 12
    statLabel.TextScaled = true
    statLabel.Parent = statFrame
    
    local valueLabel = Instance.new("TextLabel")
    valueLabel.Size = UDim2.new(1, 0, 0.4, 0)
    valueLabel.Position = UDim2.new(0, 0, 0.6, 0)
    valueLabel.BackgroundTransparency = 1
    valueLabel.Text = value
    valueLabel.TextColor3 = Color3.fromRGB(100, 200, 255)
    valueLabel.Font = Enum.Font.GothamBold
    valueLabel.TextSize = 16
    valueLabel.TextScaled = true
    valueLabel.Parent = statFrame
    
    return valueLabel
end

local serversFoundLabel = createStatLabel("Servers Found", "0", UDim2.new(0, 10, 0, 5))
local serversJoinedLabel = createStatLabel("Joined", "0", UDim2.new(0.5, 0, 0, 5))
local uptimeLabel = createStatLabel("Uptime", "00:00", UDim2.new(0, 10, 0, 40))
local apiCallsLabel = createStatLabel("API Calls", "0", UDim2.new(0.5, 0, 0, 40))

-- Botões principais
local buttonContainer = Instance.new("Frame")
buttonContainer.Size = UDim2.new(1, -40, 0, 60)
buttonContainer.Position = UDim2.new(0, 20, 0, 175)
buttonContainer.BackgroundTransparency = 1
buttonContainer.Parent = mainFrame

-- Botão Connect/Disconnect principal
local connectButton = Instance.new("TextButton")
connectButton.Size = UDim2.new(0.7, -5, 1, 0)
connectButton.Position = UDim2.new(0, 0, 0, 0)
connectButton.BackgroundColor3 = Color3.fromRGB(40, 150, 255)
connectButton.BackgroundTransparency = 0.1
connectButton.TextColor3 = Color3.fromRGB(255, 255, 255)
connectButton.Font = Enum.Font.GothamBold
connectButton.TextSize = 20
connectButton.Text = "🚀 CONNECT"
connectButton.AutoButtonColor = false
connectButton.Parent = buttonContainer

local connectCorner = Instance.new("UICorner")
connectCorner.CornerRadius = UDim.new(0, 15)
connectCorner.Parent = connectButton

local connectStroke = Instance.new("UIStroke")
connectStroke.Color = Color3.fromRGB(80, 180, 255)
connectStroke.Thickness = 2
connectStroke.Transparency = 0.4
connectStroke.Parent = connectButton

local connectGradient = Instance.new("UIGradient")
connectGradient.Color = ColorSequence.new{
    ColorSequenceKeypoint.new(0, Color3.fromRGB(60, 170, 255)),
    ColorSequenceKeypoint.new(1, Color3.fromRGB(40, 120, 220))
}
connectGradient.Rotation = 90
connectGradient.Parent = connectButton

-- Botão Settings
local settingsButton = Instance.new("TextButton")
settingsButton.Size = UDim2.new(0.3, -5, 1, 0)
settingsButton.Position = UDim2.new(0.7, 5, 0, 0)
settingsButton.BackgroundColor3 = Color3.fromRGB(60, 60, 80)
settingsButton.BackgroundTransparency = 0.2
settingsButton.TextColor3 = Color3.fromRGB(200, 200, 220)
settingsButton.Font = Enum.Font.GothamBold
settingsButton.TextSize = 16
settingsButton.Text = "⚙️"
settingsButton.AutoButtonColor = false
settingsButton.Parent = buttonContainer

local settingsCorner = Instance.new("UICorner")
settingsCorner.CornerRadius = UDim.new(0, 15)
settingsCorner.Parent = settingsButton

-- Info bar
local infoFrame = Instance.new("Frame")
infoFrame.Size = UDim2.new(1, -40, 0, 30)
infoFrame.Position = UDim2.new(0, 20, 1, -45)
infoFrame.BackgroundColor3 = Color3.fromRGB(30, 35, 45)
infoFrame.BackgroundTransparency = 0.2
infoFrame.BorderSizePixel = 0
infoFrame.Parent = mainFrame

local infoCorner = Instance.new("UICorner")
infoCorner.CornerRadius = UDim.new(0, 10)
infoCorner.Parent = infoFrame

local infoLabel = Instance.new("TextLabel")
infoLabel.Size = UDim2.new(1, -20, 1, 0)
infoLabel.Position = UDim2.new(0, 10, 0, 0)
infoLabel.BackgroundTransparency = 1
infoLabel.Text = "💤 Standby - Ready to connect..."
infoLabel.TextColor3 = Color3.fromRGB(180, 200, 240)
infoLabel.Font = Enum.Font.Gotham
infoLabel.TextSize = 12
infoLabel.TextScaled = true
infoLabel.Parent = infoFrame

-- Botão Close moderno
local closeButton = Instance.new("TextButton")
closeButton.Size = UDim2.new(0, 25, 0, 25)
closeButton.Position = UDim2.new(1, -35, 0, 10)
closeButton.BackgroundColor3 = Color3.fromRGB(255, 70, 70)
closeButton.BackgroundTransparency = 0.2
closeButton.Text = "✕"
closeButton.TextColor3 = Color3.fromRGB(255, 255, 255)
closeButton.Font = Enum.Font.GothamBold
closeButton.TextSize = 12
closeButton.AutoButtonColor = false
closeButton.Parent = mainFrame

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(1, 0)
closeCorner.Parent = closeButton

-- 🎭 SISTEMA DE ANIMAÇÕES AVANÇADAS
local function createHoverEffect(button, normalColor, hoverColor, normalTrans, hoverTrans)
    button.MouseEnter:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.3, Enum.EasingStyle.Quad), {
            BackgroundColor3 = hoverColor,
            BackgroundTransparency = hoverTrans,
            Size = button.Size + UDim2.new(0, 2, 0, 1)
        }):Play()
    end)
    
    button.MouseLeave:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.3, Enum.EasingStyle.Quad), {
            BackgroundColor3 = normalColor,
            BackgroundTransparency = normalTrans,
            Size = button.Size - UDim2.new(0, 2, 0, 1)
        }):Play()
    end)
end

createHoverEffect(connectButton, Color3.fromRGB(40, 150, 255), Color3.fromRGB(60, 180, 255), 0.1, 0.05)
createHoverEffect(settingsButton, Color3.fromRGB(60, 60, 80), Color3.fromRGB(80, 80, 120), 0.2, 0.1)
createHoverEffect(closeButton, Color3.fromRGB(255, 70, 70), Color3.fromRGB(255, 100, 100), 0.2, 0.1)

-- Animação de pulsação para status
local function pulseAnimation()
    while statusCircle.Parent do
        TweenService:Create(statusGlow, TweenInfo.new(1.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
            Transparency = 0.2
        }):Play()
        wait(1.5)
    end
end

-- Animação RGB da borda
local function rgbBorderAnimation()
    while borderStroke.Parent do
        for i = 0, 360, 10 do
            local hue = i / 360
            local color = Color3.fromHSV(hue, 0.8, 1)
            TweenService:Create(borderStroke, TweenInfo.new(0.1), {Color = color}):Play()
            wait(0.1)
        end
    end
end

spawn(pulseAnimation)
spawn(rgbBorderAnimation)

-- 🚀 SISTEMA AUTOJOIN OTIMIZADO
local function updateStats()
    local uptime = tick() - stats.startTime
    local hours = math.floor(uptime / 3600)
    local minutes = math.floor((uptime % 3600) / 60)
    local seconds = math.floor(uptime % 60)
    
    serversFoundLabel.Text = tostring(stats.serversFound)
    serversJoinedLabel.Text = tostring(stats.serversJoined)
    uptimeLabel.Text = string.format("%02d:%02d:%02d", hours, minutes, seconds)
    apiCallsLabel.Text = tostring(stats.apiCalls)
end

local function updateInfo(message, color)
    infoLabel.Text = message
    if color then
        infoLabel.TextColor3 = color
    end
end

local function joinJob(jobId, serverInfo)
    knownJobIds[jobId] = true
    lastJobId = jobId
    stats.serversJoined = stats.serversJoined + 1
    
    local serverName = serverInfo.server_name or "Unknown Server"
    local players = serverInfo.players or "?/?"
    local money = serverInfo.money_per_sec or "Unknown"
    
    print(string.format("🚀 Joining: %s | Players: %s | Money: %s | JobID: %s", 
          serverName, players, money, string.sub(jobId, 1, 12) .. "..."))
    
    updateInfo(string.format("🚀 Joining %s (%s)", serverName, players), Color3.fromRGB(100, 255, 150))
    playSound(SOUNDS.serverFound)
    
    pcall(function()
        TeleportService:TeleportToPlaceInstance(CONFIG.PLACE_ID, jobId, LocalPlayer)
    end)
end

local function parsePlayerCount(playersStr)
    if not playersStr or playersStr == "" then return 0, 8 end
    local current, max = string.match(playersStr, "(%d+)/(%d+)")
    return tonumber(current) or 0, tonumber(max) or 8
end

local function shouldJoinServer(serverInfo)
    local currentPlayers, maxPlayers = parsePlayerCount(serverInfo.players)
    
    if currentPlayers < CONFIG.MIN_PLAYERS then return false, "Too few players" end
    if currentPlayers >= CONFIG.MAX_PLAYERS then return false, "Server full" end
    
    return true, "OK"
end

local function fetchServers()
    if not autoJoinEnabled then return end
    
    local success, response = pcall(function()
        return game:HttpGet(CONFIG.BACKEND_URL)
    end)
    
    stats.apiCalls = stats.apiCalls + 1
    
    if not success then
        stats.errors = stats.errors + 1
        return
    end
    
    local success2, servers = pcall(function()
        return HttpService:JSONDecode(response)
    end)
    
    if not success2 or type(servers) ~= "table" then
        stats.errors = stats.errors + 1
        return
    end
    
    stats.serversFound = #servers
    stats.lastUpdate = tick()
    
    -- Prioriza plataformas preferidas
    for _, preferredPlatform in ipairs(CONFIG.PREFERRED_PLATFORMS) do
        for i = #servers, 1, -1 do
            local server = servers[i]
            if server.job_ids and server.platform == preferredPlatform then
                for _, jobId in ipairs(server.job_ids) do
                    if not knownJobIds[jobId] then
                        local canJoin, reason = shouldJoinServer(server)
                        if canJoin then
                            joinJob(jobId, server)
                            return
                        end
                    end
                end
            end
        end
    end
end

local function initializeKnownJobIds()
    updateInfo("🔍 Scanning existing servers...", Color3.fromRGB(255, 200, 100))
    
    local success, response = pcall(function()
        return game:HttpGet(CONFIG.BACKEND_URL)
    end)
    
    if not success then return end
    
    local success2, servers = pcall(function()
        return HttpService:JSONDecode(response)
    end)
    
    if not success2 or type(servers) ~= "table" then return end
    
    for _, server in ipairs(servers) do
        if server.job_ids then
            for _, jobId in ipairs(server.job_ids) do
                knownJobIds[jobId] = true
            end
        end
    end
    
    updateInfo(string.format("✅ Initialized with %d known servers", #servers), Color3.fromRGB(100, 255, 150))
end

-- 🎮 EVENT HANDLERS
connectButton.MouseButton1Click:Connect(function()
    if not autoJoinEnabled then
        autoJoinEnabled = true
        connectButton.Text = "🔥 ACTIVE"
        
        -- Mudanças visuais para estado ativo
        statusCircle.BackgroundColor3 = Color3.fromRGB(100, 255, 120)
        statusGlow.Color = Color3.fromRGB(100, 255, 120)
        
        connectGradient.Color = ColorSequence.new{
            ColorSequenceKeypoint.new(0, Color3.fromRGB(100, 255, 120)),
            ColorSequenceKeypoint.new(1, Color3.fromRGB(50, 200, 80))
        }
        connectStroke.Color = Color3.fromRGB(120, 255, 150)
        
        updateInfo("🔥 AutoJoin Active - Hunting for servers...", Color3.fromRGB(100, 255, 150))
        playSound(SOUNDS.connect)
        
        initializeKnownJobIds()
    else
        autoJoinEnabled = false
        connectButton.Text = "🚀 CONNECT"
        
        -- Volta ao estado original
        statusCircle.BackgroundColor3 = Color3.fromRGB(255, 80, 80)
        statusGlow.Color = Color3.fromRGB(255, 80, 80)
        
        connectGradient.Color = ColorSequence.new{
            ColorSequenceKeypoint.new(0, Color3.fromRGB(60, 170, 255)),
            ColorSequenceKeypoint.new(1, Color3.fromRGB(40, 120, 220))
        }
        connectStroke.Color = Color3.fromRGB(80, 180, 255)
        
        updateInfo("💤 AutoJoin Stopped - Ready to reconnect", Color3.fromRGB(180, 200, 240))
        playSound(SOUNDS.disconnect)
    end
end)

settingsButton.MouseButton1Click:Connect(function()
    updateInfo("⚙️ Settings panel coming soon!", Color3.fromRGB(255, 200, 100))
end)

closeButton.MouseButton1Click:Connect(function()
    TweenService:Create(mainFrame, TweenInfo.new(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.In), {
        Size = UDim2.new(0, 0, 0, 0),
        BackgroundTransparency = 1
    }):Play()
    wait(0.3)
    screenGui:Destroy()
end)

-- 🎯 SISTEMA DE ARRASTAR (DRAG)
local dragging, dragInput, dragStart, startPos

local function updateDrag(input)
    local delta = input.Position - dragStart
    mainFrame.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + delta.X,
                                  startPos.Y.Scale, startPos.Y.Offset + delta.Y)
end

mainFrame.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        dragging = true
        dragStart = input.Position
        startPos = mainFrame.Position

        input.Changed:Connect(function()
            if input.UserInputState == Enum.UserInputState.End then
                dragging = false
            end
        end)
    end
end)

mainFrame.InputChanged:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseMovement then
        dragInput = input
    end
end)

UserInputService.InputChanged:Connect(function(input)
    if dragging and input == dragInput then
        updateDrag(input)
    end
end)

-- 🎬 ANIMAÇÃO DE ENTRADA
mainFrame.Size = UDim2.new(0, 0, 0, 0)
mainFrame.BackgroundTransparency = 1

wait(0.1)
TweenService:Create(mainFrame, TweenInfo.new(0.8, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
    Size = UDim2.new(0, 420, 0, 280),
    BackgroundTransparency = 0
}):Play()

-- 🔄 LOOPS PRINCIPAIS
-- Loop de atualização de stats
spawn(function()
    while screenGui.Parent do
        updateStats()
        task.wait(1)
    end
end)

-- Loop principal do AutoJoin (ULTRA OTIMIZADO)
spawn(function()
    while screenGui.Parent do
        fetchServers()
        task.wait(CONFIG.CHECK_INTERVAL)
    end
end)

-- 🎵 Som de inicialização
wait(0.5)
playSound(SOUNDS.connect)

print("⚡ AutoJoin Ultra iniciado com sucesso!")
print("🎯 Configurado para Place ID:", CONFIG.PLACE_ID)
print("🌐 Backend URL:", CONFIG.BACKEND_URL)
print("⏱️ Intervalo de verificação:", CONFIG.CHECK_INTERVAL, "segundos")
