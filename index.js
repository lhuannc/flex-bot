require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { createWebServer } = require('./web/server');
const discordService = require('./services/discordService');

// 1. Configuração dos Intents do Discord.js v14
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Necessário para ler o texto digitado nos canais autorizados
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel, // Necessário para escutar DMs em canais não cacheados
    Partials.Message
  ]
});

// Registra a referência do cliente no serviço
discordService.setClient(client);

// 2. Carregamento dinâmico dos Comandos (Command Handler)
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`[Command Handler] Comando carregado: /${command.data.name}`);
    }
  }
}

// 3. Carregamento dinâmico dos Eventos (Event Handler)
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`[Event Handler] Evento registrado: ${event.name}`);
  }
}

// 4. Inicialização do Servidor Web (Dashboard Express)
const PORT = process.env.PORT || 3000;
const app = createWebServer();

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Dashboard Web rodando em: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

// 5. Login do Bot no Discord (Se o Token estiver configurado)
if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== 'seu_token_aqui') {
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Erro ao conectar o bot no Discord:', err.message);
  });
} else {
  console.warn('⚠️ DISCORD_TOKEN não foi configurado no arquivo .env. O servidor web continuará funcionando para testes de interface.');
}
