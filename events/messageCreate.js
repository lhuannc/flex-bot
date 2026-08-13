import * as ivrService from '../services/ivrService.js';
import * as ruleService from '../services/ruleService.js';
import * as stoatService from '../services/stoatService.js';
import * as dmTriggerService from '../services/dmTriggerService.js';
import { deleteMessage, scheduleDeletion } from '../services/messageUtils.js';

export const name = 'messageCreate';

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

/**
 * Despacha comandos de texto com prefixo.
 * O Stoat não possui Slash Commands, então os comandos são interpretados
 * a partir do conteúdo da mensagem (ex.: "!matricula 12345678").
 * @returns {Promise<boolean>} true se a mensagem era um comando conhecido
 */
async function handlePrefixCommand(message, client) {
  const prefix = process.env.COMMAND_PREFIX || '!';
  const content = message.content.trim();

  if (!content.startsWith(prefix)) return false;

  const withoutPrefix = content.slice(prefix.length).trim();
  if (!withoutPrefix) return false;

  const [rawName, ...args] = withoutPrefix.split(/\s+/);
  const command = client.commands.get(rawName.toLowerCase());

  if (!command) return false;

  try {
    await command.execute({ message, args, client });
  } catch (error) {
    console.error(`[Command Handler] Erro ao executar "${rawName}":`, error);
    await message.reply('❌ Ocorreu um erro interno ao processar este comando.').catch(() => {});
  }

  return true;
}

/**
 * @param {import('stoat.js').Message} message
 * @param {import('stoat.js').Client} client
 */
export async function execute(message, client) {
  // Ignora mensagens do próprio bot e de outros bots
  if (!message.author || message.author.bot || message.authorId === client.user?.id) return;

  const content = message.content?.trim();
  if (!content) return;

  const userId = message.authorId;
  const channel = message.channel;
  if (!channel) return;

  // 1. Comandos com prefixo têm prioridade sobre qualquer outro fluxo
  const handledByCommand = await handlePrefixCommand(message, client);
  if (handledByCommand) return;

  // =========================================================================
  // CASO 1: MENSAGEM DIRETA (DM / PRIVADO DO BOT)
  // =========================================================================
  if (channel.type === 'DirectMessage') {
    console.log(`[MessageCreate DM] Recebida DM do usuário ${message.author.username} (${userId}): "${content}"`);

    // 1. Tenta processar via URA em Etapas (Menu Principal, Submenu, Aguardando Matrícula ou Palavras-Chave de Menu)
    const handledByIVR = await ivrService.processIVRMessage(message);
    if (handledByIVR) return;

    // 2. Se não foi capturado por opção da URA, avalia validação direta de matrícula
    const result = ruleService.evaluateRules(content, null, true, null);

    if (result.success) {
      const roleId = result.roleIdToAssign || process.env.ROLE_ID;
      const targetServerId = result.serverIdToAssign || process.env.SERVER_ID;

      if (roleId) {
        const roleResult = await stoatService.assignRoleToUser(userId, roleId, targetServerId);
        if (roleResult.success) {
          const roleName = roleResult.roleName || 'Cargo de Acesso';
          await message.reply(`✅ **Acesso Liberado!** Sua matrícula **${content}** foi validada com sucesso e seu cargo **${roleName}** foi atribuído.`);
        } else {
          await message.reply(`✅ **Matrícula Validada!** Matrícula **${content}** confirmada (${roleResult.message}).`);
        }
      } else {
        await message.reply(`✅ **Acesso Liberado!** Sua matrícula **${content}** foi validada.`);
      }
    } else {
      // Se a matrícula não foi encontrada e o texto não era uma opção da URA, exibe mensagem clara + apresenta o menu da URA
      await message.reply(`❌ **Matrícula "${content}" não encontrada na base.**\nVerifique se os 8 números foram digitados corretamente.`);

      // Apresenta o Menu da URA para orientar o usuário
      await ivrService.sendRootIVRMenu(message.author, '💡 **Por favor, escolha uma das opções do menu de atendimento:**');
    }
    return;
  }

  // =========================================================================
  // CASO 2: MENSAGEM DIGITADA EM UM CANAL DO SERVIDOR
  // =========================================================================
  const server = message.server;
  if (!server) return;

  const channelId = channel.id;
  const serverId = server.id;
  const serverName = server.name;

  // A. Verificação de Gatilho: Post em canal de boas-vindas enviando DM
  const triggers = dmTriggerService.getDMTriggers();
  if (triggers.channelFirstPost && triggers.channelFirstPost.enabled && triggers.channelFirstPost.channelId === channelId) {
    const rawMsg = triggers.channelFirstPost.message || '👋 **Olá {user}!** Vimos que você enviou uma mensagem no canal. Por favor responda aqui com sua matrícula para validar seu acesso.';
    const formatted = formatMessageTemplate(rawMsg, userId, serverName);
    await stoatService.sendDMToStoatUser(message.author, formatted);
  }

  // B. Avalia se o canal atual é um canal autorizado em alguma regra ativa de validação
  const rules = ruleService.getRules().filter(r => r.active);
  const channelRule = rules.find(r => {
    if (r.serverId && r.serverId !== serverId) return false;
    if (!r.allowedChannelId || r.allowedChannelId.trim() === '') return false;
    const allowedList = r.allowedChannelId.split(',').map(c => c.trim());
    return allowedList.includes(channelId);
  });

  if (!channelRule) return;

  console.log(`[MessageCreate Canal] Validação digitada no canal #${channel.name} por ${message.author.username}: "${content}"`);

  const deleteDelay = typeof channelRule.deleteDelaySeconds === 'number' ? channelRule.deleteDelaySeconds : 10;
  const result = ruleService.evaluateRules(content, channelId, false, serverId);

  // A mensagem original com a matrícula é sempre removida do canal público
  await deleteMessage(message, `matrícula digitada em #${channel.name}`);

  if (result.success) {
    const roleId = result.roleIdToAssign || process.env.ROLE_ID;
    const targetServerId = result.serverIdToAssign || serverId;

    let roleName = '';
    if (roleId) {
      const roleResult = await stoatService.assignRoleToUser(userId, roleId, targetServerId);
      if (roleResult.success) {
        roleName = roleResult.roleName || 'Cargo';
      }
    }

    const rawSuccessMessage = channelRule.successMessage || '✅ **Acesso Liberado!** {user}, sua matrícula foi validada e seu cargo {role} foi atribuído.';
    const formattedSuccess = formatMessageTemplate(rawSuccessMessage, userId, serverName, roleName);

    const replyMsg = await channel.sendMessage(formattedSuccess).catch(() => null);
    scheduleDeletion(replyMsg, deleteDelay);
  } else {
    const rawErrorMessage = channelRule.errorMessage || '❌ {user}: **Matrícula não encontrada.** Verifique os 8 números digitados.';
    const formattedError = formatMessageTemplate(rawErrorMessage, userId, serverName);

    const replyMsg = await channel.sendMessage(formattedError).catch(() => null);
    scheduleDeletion(replyMsg, deleteDelay);
  }
}
