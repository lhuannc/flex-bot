const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Processa apenas comandos de barra (Slash Commands)
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`[InteractionCreate] Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[InteractionCreate] Erro ao executar /${interaction.commandName}:`, error);
      
      const errorMessage = { content: '❌ Ocorreu um erro interno ao processar este comando.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
