import * as ruleService from '../services/ruleService.js';
import * as stoatService from '../services/stoatService.js';
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
    const roleId = result.roleIdToAssign || process.env.ROLE_ID;
    const targetServerId = result.serverIdToAssign || serverId || process.env.SERVER_ID;

    let roleName = '';
    if (roleId) {
      const roleResult = await stoatService.assignRoleToUser(userId, roleId, targetServerId);
      if (roleResult.success) {
        roleName = roleResult.roleName || 'Cargo';
      }
    }

    const formattedSuccess = formatMessageTemplate(result.message, userId, serverName, roleName);
    const sent = await channel?.sendMessage(formattedSuccess).catch(() => null);
    if (!isDM) scheduleDeletion(sent, deleteDelay);
    return;
  }

  const formattedError = formatMessageTemplate(result.message, userId, serverName);
  const sent = await channel?.sendMessage(formattedError).catch(() => null);
  if (!isDM) scheduleDeletion(sent, deleteDelay);
}
