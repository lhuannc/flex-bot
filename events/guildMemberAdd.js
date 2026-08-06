const { Events } = require('discord.js');
const dmTriggerService = require('../services/dmTriggerService');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    console.log(`[Event GuildMemberAdd] Novo membro entrou no servidor ${member.guild.name}: ${member.user.tag} (${member.id})`);

    const triggers = dmTriggerService.getDMTriggers();

    if (triggers.serverJoin && triggers.serverJoin.enabled) {
      const rawMessage = triggers.serverJoin.message || '👋 **Seja bem-vindo(a) ao nosso servidor!**\n\nPor favor envie sua **matrícula de 8 dígitos** nesta mensagem direta para liberar seu cargo de acesso.';
      
      const formattedMessage = rawMessage
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{server\}/g, member.guild.name);

      try {
        await member.send(formattedMessage);
        console.log(`[Event GuildMemberAdd] DM de boas-vindas enviada com sucesso para ${member.user.tag}`);
      } catch (error) {
        console.warn(`[Event GuildMemberAdd] Não foi possível enviar DM para ${member.user.tag} (DMs fechadas pelo usuário).`);
      }
    }
  }
};
