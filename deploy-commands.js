const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] O comando em ${filePath} está faltando a propriedade "data" ou "execute".`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Iniciando a atualização de ${commands.length} comandos Slash (/) na API do Discord...`);

    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      console.error('❌ ERRO: Preencha DISCORD_TOKEN e CLIENT_ID no arquivo .env antes de rodar o deploy-commands.');
      process.exit(1);
    }

    if (process.env.GUILD_ID && process.env.GUILD_ID !== 'seu_guild_id_aqui') {
      // Registra no servidor específico para atualização instantânea em testes
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Sucesso! ${data.length} comandos registrados instantaneamente no servidor (GUILD_ID).`);
    } else {
      // Registra globalmente para todos os servidores que o bot estiver presente
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Sucesso! ${data.length} comandos registrados globalmente em todos os servidores.`);
    }
  } catch (error) {
    console.error('❌ Erro ao implantar comandos:', error);
  }
})();
