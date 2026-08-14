import * as ruleService from '../services/ruleService.js';
import * as stoatService from '../services/stoatService.js';
import * as databaseService from '../services/databaseService.js';
import { deleteMessage, scheduleDeletion } from '../services/messageUtils.js';

/**
 * O Stoat não possui Slash Commands (não existe API de interactions),
 * portanto os comandos são de texto, acionados pelo COMMAND_PREFIX (padrão "!").
 *
 * Uso: !matricula 12345678
 */
export const name = 'matricula';
export const description = 'Valida sua matrícula corporativa/acadêmica para acesso.';
export const usage = 'matricula <numero>';

/**
 * Formata o modelo da mensagem substituindo as variáveis {user}, {server} e {role}
 */
function formatMessageTemplate(template, userId, serverName = '', roleName = '') {
  if (!template) return '';
  return template
    .replace(/\{user\}/g, `<@${userId}>`)
    .replace(/\{server\}/g, serverName)
    .replace(/\{role\}/g, roleName);
}

export async function execute({ message, args }) {
  const prefix = process.env.COMMAND_PREFIX || '!';
  const numero = (args[0] || '').trim();

  if (!numero) {
    await message.reply(`⚠️ Informe o número da matrícula. Exemplo: \`${prefix}matricula 12345678\``);
    return;
  }

  const channel = message.channel;
  const server = message.server;
  const isDM = channel?.type === 'DirectMessage';
  const channelId = channel?.id ?? null;
  const serverId = server?.id ?? null;
  const serverName = server?.name ?? '';
  const userId = message.authorId;

  // Avalia as regras cadastradas para este servidor/canal
  const result = ruleService.evaluateRules(numero, channelId, isDM, serverId);

  // Se o comando foi enviado em um canal não autorizado
  if (result.isChannelInvalid) {
    await message.reply(result.message);
    return;
  }

  const deleteDelay = typeof result.matchedRule?.deleteDelaySeconds === 'number'
    ? result.matchedRule.deleteDelaySeconds
    : 10;

  // Em canais públicos a matrícula digitada é removida para não ficar exposta
  if (!isDM) {
    await deleteMessage(message, `comando !matricula em #${channel?.name}`);
  }

  if (result.success) {
    // Consome a matrícula: a partir daqui ela não pode ser usada por mais ninguém
    const claim = databaseService.consumirMatricula(numero, {
      userId,
      username: message.author?.username || '',
      origin: 'COMANDO'
    });

    if (!claim.success) {
      const usedTemplate = result.matchedRule?.usedMessage || ruleService.DEFAULT_USED_MESSAGE;
      const formattedUsed = formatMessageTemplate(usedTemplate, userId, serverName);
      const sentUsed = await channel?.sendMessage(formattedUsed).catch(() => null);
      if (!isDM) scheduleDeletion(sentUsed, deleteDelay);
      return;
    }

    const roleId = result.roleIdToAssign || process.env.ROLE_ID;
    const targetServerId = result.serverIdToAssign || serverId || process.env.SERVER_ID;

    let roleName = '';
    if (roleId) {
      const roleResult = await stoatService.assignRoleToUser(userId, roleId, targetServerId);
      if (roleResult.success) {
        roleName = roleResult.roleName || 'Cargo';
      } else {
        // O cargo não foi aplicado: devolve a matrícula para que o usuário possa tentar novamente
        databaseService.liberarMatricula(numero);
        const sentFail = await channel?.sendMessage(
          `⚠️ <@${userId}> Sua matrícula é válida, mas não foi possível aplicar o cargo agora (${roleResult.message}). Tente novamente em instantes.`
        ).catch(() => null);
        if (!isDM) scheduleDeletion(sentFail, deleteDelay);
        return;
      }
    }

    const actions = result.matchedRule?.actions || {};

    if (actions.sendMessage !== false) {
      const formattedSuccess = formatMessageTemplate(result.message, userId, serverName, roleName);
      const sent = await channel?.sendMessage(formattedSuccess).catch(() => null);
      if (!isDM) scheduleDeletion(sent, deleteDelay);
    }

    // ENTÃO: Enviar mensagem na DM (se configurado na regra e ainda não estamos na DM)
    if (actions.sendDM && result.matchedRule?.dmMessage && !isDM) {
      const formattedDM = formatMessageTemplate(result.matchedRule.dmMessage, userId, serverName, roleName);
      await stoatService.sendDMToStoatUser(message.author, formattedDM);
    }
    return;
  }

  const formattedError = formatMessageTemplate(result.message, userId, serverName);
  const sent = await channel?.sendMessage(formattedError).catch(() => null);
  if (!isDM) scheduleDeletion(sent, deleteDelay);
}
