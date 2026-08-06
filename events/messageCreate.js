const { Events } = require('discord.js');
const ivrService = require('../services/ivrService');
const ruleService = require('../services/ruleService');
const discordService = require('../services/discordService');
const dmTriggerService = require('../services/dmTriggerService');

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
  name: Events.MessageCreate,
  async execute(message) {
    // Ignora mensagens enviadas por outros bots
    if (message.author.bot) return;

    const content = message.content.trim();
    const userId = message.author.id;

    // =========================================================================
    // CASO 1: MENSAGEM DIRETA (DM / PRIVADO DO BOT)
    // =========================================================================
    if (!message.guild) {
      console.log(`[MessageCreate DM] Recebida DM do usuário ${message.author.tag} (${userId}): "${content}"`);

      // 1. Tenta processar via URA em Etapas (Menu Principal, Submenu, Aguardando Matrícula ou Palavras-Chave de Menu)
      const handledByIVR = await ivrService.processIVRMessage(message);
      if (handledByIVR) return;

      // 2. Se não foi capturado por opção da URA, avalia validação direta de matrícula
      const result = ruleService.evaluateRules(content, null, true, null);

      if (result.success) {
        const roleId = result.roleIdToAssign || process.env.ROLE_ID;
        const targetGuildId = result.guildIdToAssign || process.env.GUILD_ID;

        let roleName = '';
        if (roleId) {
          const roleResult = await discordService.assignRoleToUser(userId, roleId, targetGuildId);
          if (roleResult.success) {
            const guild = await discordService.getGuild(targetGuildId);
            const role = guild ? await guild.roles.fetch(roleId).catch(() => null) : null;
            roleName = role ? role.name : 'Cargo de Acesso';
            await message.reply(`✅ **Acesso Liberado!** Sua matrícula **${content}** foi validada com sucesso e seu cargo **${roleName}** foi atribuído.`);
          } else {
            await message.reply(`✅ **Matrícula Validada!** Matrícula **${content}** confirmada (${roleResult.message}).`);
          }
        } else {
          await message.reply(`✅ **Acesso Liberado!** Sua matrícula **${content}** foi validada.`);
        }
      } else {
        // Se a matrícula não foi encontrada e o texto não era uma opção da URA, exibe mensagem clara + apresenta o menu da URA
        const errorText = `❌ **Matrícula "${content}" não encontrada na base.**\nVerifique se os 8 números foram digitados corretamente.`;
        await message.reply(errorText);

        // Apresenta o Menu da URA para orientar o usuário
        await ivrService.sendRootIVRMenu(message.author, '💡 **Por favor, escolha uma das opções do menu de atendimento:**');
      }
      return;
    }

    // =========================================================================
    // CASO 2: MENSAGEM DIGITADA EM UM CANAL DO SERVIDOR
    // =========================================================================
    const channelId = message.channel.id;
    const guildId = message.guild.id;
    const guildName = message.guild.name;

    // A. Verificação de Gatilho: Post em canal de boas-vindas enviando DM
    const triggers = dmTriggerService.getDMTriggers();
    if (triggers.channelFirstPost && triggers.channelFirstPost.enabled && triggers.channelFirstPost.channelId === channelId) {
      const rawMsg = triggers.channelFirstPost.message || '👋 **Olá {user}!** Vimos que você enviou uma mensagem no canal. Por favor responda aqui com sua matrícula para validar seu acesso.';
      const formatted = formatMessageTemplate(rawMsg, userId, guildName);
      await message.author.send(formatted).catch(() => {});
    }

    // B. Avalia se o canal atual é um canal autorizado em alguma regra ativa de validação
    const rules = ruleService.getRules().filter(r => r.active);
    const channelRule = rules.find(r => {
      if (r.guildId && r.guildId !== guildId) return false;
      if (!r.allowedChannelId || r.allowedChannelId.trim() === '') return false;
      const allowedList = r.allowedChannelId.split(',').map(c => c.trim());
      return allowedList.includes(channelId);
    });

    if (channelRule) {
      console.log(`[MessageCreate Canal] Validação digitada no canal #${message.channel.name} por ${message.author.tag}: "${content}"`);

      const deleteDelay = typeof channelRule.deleteDelaySeconds === 'number' ? channelRule.deleteDelaySeconds : 10;
      const result = ruleService.evaluateRules(content, channelId, false, guildId);

      if (result.success) {
        const roleId = result.roleIdToAssign || process.env.ROLE_ID;
        const targetGuildId = result.guildIdToAssign || guildId;

        await message.delete().catch(() => {});

        let roleName = '';
        if (roleId) {
          const roleResult = await discordService.assignRoleToUser(userId, roleId, targetGuildId);
          if (roleResult.success) {
            const guild = await discordService.getGuild(targetGuildId);
            const role = guild ? await guild.roles.fetch(roleId).catch(() => null) : null;
            roleName = role ? role.name : 'Cargo';
          }
        }

        const rawSuccessMessage = channelRule.successMessage || '✅ **Acesso Liberado!** {user}, sua matrícula foi validada e seu cargo {role} foi atribuído.';
        const formattedSuccess = formatMessageTemplate(rawSuccessMessage, userId, guildName, roleName);

        const replyMsg = await message.channel.send(formattedSuccess);

        if (deleteDelay > 0) {
          setTimeout(() => replyMsg.delete().catch(() => {}), deleteDelay * 1000);
        }

      } else {
        await message.delete().catch(() => {});

        const rawErrorMessage = channelRule.errorMessage || '❌ {user}: **Matrícula não encontrada.** Verifique os 8 números digitados.';
        const formattedError = formatMessageTemplate(rawErrorMessage, userId, guildName);

        const replyMsg = await message.channel.send(formattedError);

        if (deleteDelay > 0) {
          setTimeout(() => replyMsg.delete().catch(() => {}), deleteDelay * 1000);
        }
      }
    }
  }
};
