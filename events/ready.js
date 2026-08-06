const { Events } = require('discord.js');
const discordService = require('../services/discordService');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[Event Ready] Bot conectado com sucesso como: ${client.user.tag}`);
    discordService.setClient(client);

    // Define atividade do bot
    client.user.setActivity('Validação de Matrículas | /matricula', { type: 0 });
  }
};
