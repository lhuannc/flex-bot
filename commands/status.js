const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/databaseService');
const ruleService = require('../services/ruleService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Exibe o status do FlexBot e estatísticas de validação.'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const totalMatriculas = databaseService.getMatriculas().length;
    const totalRegras = ruleService.getRules().length;
    const regrasAtivas = ruleService.getRules().filter(r => r.active).length;

    const embed = new EmbedBuilder()
      .setTitle('🤖 Status do FlexBot · Prefeitura do Rio 2025')
      .setColor('#13335a')
      .addFields(
        { name: '🟢 Status', value: 'Online e Operacional', inline: true },
        { name: '📋 Matrículas Autorizadas', value: `${totalMatriculas}`, inline: true },
        { name: '⚙️ Regras de Canais', value: `${regrasAtivas} / ${totalRegras}`, inline: true },
        { name: '🌐 Dashboard Web', value: `http://localhost:${process.env.PORT || 3000}`, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
