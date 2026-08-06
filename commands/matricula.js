const { SlashCommandBuilder } = require('discord.js');
const ruleService = require('../services/ruleService');
const discordService = require('../services/discordService');

/**
 * Formata o modelo da mensagem substituindo as variáveis {user}, {server} e {role}
 */
function formatMessageTemplate(template, userId, guildName = '', roleName = '') {
  if (!template) return '';
  return template
    .replace(/\{user\}/g, `<@${userId}>`)
    .replace(/\{server\}/g, guildName)
    .replace(/\{role\}/g, roleName);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('matricula')
    .setDescription('Valida sua matrícula corporativa/acadêmica para acesso.')
    .addStringOption(option =>
      option
        .setName('numero')
        .setDescription('Digite seu número de matrícula (ex: 12345678)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const numero = interaction.options.getString('numero').trim();
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;
    const guildName = interaction.guild ? interaction.guild.name : '';
    const userId = interaction.user.id;

    // Avalia as regras cadastradas para esta guilda/canal
    const result = ruleService.evaluateRules(numero, channelId, false, guildId);

    // Se o comando foi enviado em um canal não autorizado
    if (result.isChannelInvalid) {
      return await interaction.editReply(result.message);
    }

    if (result.success) {
      const roleId = result.roleIdToAssign || process.env.ROLE_ID;
      const targetGuildId = result.guildIdToAssign || guildId || process.env.GUILD_ID;

      let roleName = '';
      if (roleId) {
        const roleResult = await discordService.assignRoleToUser(userId, roleId, targetGuildId);
        if (roleResult.success && interaction.guild) {
          const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
          roleName = role ? role.name : 'Cargo';
        }
      }

      const formattedSuccess = formatMessageTemplate(result.message, userId, guildName, roleName);
      return await interaction.editReply(formattedSuccess);

    } else {
      const formattedError = formatMessageTemplate(result.message, userId, guildName);
      return await interaction.editReply(formattedError);
    }
  }
};
