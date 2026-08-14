import * as dmTriggerService from '../services/dmTriggerService.js';
import * as ruleService from '../services/ruleService.js';
import * as stoatService from '../services/stoatService.js';
import { scheduleDeletion } from '../services/messageUtils.js';

export const name = 'serverMemberJoin';

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
 * Executa o ENTÃO de uma regra cujo QUANDO é "Novos membros do servidor".
 * @param {object} rule
 * @param {import('stoat.js').User|undefined} user
 * @param {string} userId
 * @param {string} serverId
 * @param {string} serverName
 */
async function executeMemberJoinRule(rule, user, userId, serverId, serverName) {
  const actions = rule.actions || {};
  let roleName = '';

  // ENTÃO 1: Atribuir cargo
  if (actions.assignRole && rule.roleId) {
    const roleResult = await stoatService.assignRoleToUser(userId, rule.roleId, rule.serverId || serverId);
    if (roleResult.success) {
      roleName = roleResult.roleName || 'Cargo';
      console.log(`[ServerMemberJoin] Regra "${rule.name}": cargo "${roleName}" atribuído ao novo membro.`);
    } else {
      console.warn(`[ServerMemberJoin] Regra "${rule.name}": falha ao atribuir cargo — ${roleResult.message}`);
    }
  }

  // ENTÃO 2: Enviar mensagem no canal configurado no Passo 1
  if (actions.sendMessage) {
    if (!rule.allowedChannelId) {
      console.warn(`[ServerMemberJoin] Regra "${rule.name}" envia mensagem, mas nenhum canal foi selecionado no Passo 1.`);
    } else {
      // O campo aceita lista separada por vírgula; para boas-vindas usamos o primeiro
      const channelId = rule.allowedChannelId.split(',')[0].trim();
      const formatted = formatMessageTemplate(rule.successMessage, userId, serverName, roleName);

      if (!formatted) {
        console.warn(`[ServerMemberJoin] Regra "${rule.name}" está sem texto de mensagem configurado.`);
      } else {
        const result = await stoatService.sendMessageToChannel(channelId, formatted);

        if (result.success) {
          console.log(`[ServerMemberJoin] Regra "${rule.name}": mensagem publicada no canal.`);

          const delay = typeof rule.deleteDelaySeconds === 'number' ? rule.deleteDelaySeconds : 0;
          scheduleDeletion(result.sentMessage, delay, `boas-vindas da regra "${rule.name}"`);
        } else {
          console.warn(`[ServerMemberJoin] Regra "${rule.name}": falha ao publicar mensagem — ${result.message}`);
        }
      }
    }
  }

  // ENTÃO 3: Enviar mensagem na DM do novo membro
  if (actions.sendDM) {
    const formattedDM = formatMessageTemplate(rule.dmMessage, userId, serverName, roleName);

    if (!formattedDM) {
      console.warn(`[ServerMemberJoin] Regra "${rule.name}" envia DM, mas o texto da DM está vazio.`);
    } else if (!user) {
      console.warn(`[ServerMemberJoin] Regra "${rule.name}": usuário indisponível para envio de DM.`);
    } else {
      const delivered = await stoatService.sendDMToStoatUser(user, formattedDM);
      if (delivered) {
        console.log(`[ServerMemberJoin] Regra "${rule.name}": DM enviada ao novo membro.`);
      } else {
        console.warn(`[ServerMemberJoin] Regra "${rule.name}": não foi possível enviar a DM (DMs bloqueadas pelo usuário).`);
      }
    }
  }
}

/**
 * Dispara as boas-vindas quando um novo membro entra no servidor do Stoat:
 * a DM privada configurada na aba de DM e as regras com QUANDO = "Novos membros".
 * @param {import('stoat.js').ServerMember} member
 */
export async function execute(member) {
  const serverName = member.server?.name || 'servidor';
  const serverId = member.server?.id || null;
  const userId = member.id.user;

  console.log(`[Event ServerMemberJoin] Novo membro entrou no servidor ${serverName}: ${member.user?.username} (${userId})`);

  // 1. Boas-vindas na DM privada do novo membro
  const triggers = dmTriggerService.getDMTriggers();

  if (triggers.serverJoin && triggers.serverJoin.enabled) {
    const rawMessage = triggers.serverJoin.message || '👋 **Seja bem-vindo(a) ao nosso servidor!**\n\nPor favor envie sua **matrícula de 8 dígitos** nesta mensagem direta para liberar seu cargo de acesso.';
    const formattedMessage = formatMessageTemplate(rawMessage, userId, serverName);

    const delivered = member.user
      ? await stoatService.sendDMToStoatUser(member.user, formattedMessage)
      : false;

    if (delivered) {
      console.log(`[Event ServerMemberJoin] DM de boas-vindas enviada com sucesso para ${member.user?.username}`);
    } else {
      console.warn(`[Event ServerMemberJoin] Não foi possível enviar DM para ${member.user?.username} (DMs bloqueadas pelo usuário).`);
    }
  }

  // 2. Regras do wizard com QUANDO = "Novos membros do servidor"
  const rules = ruleService.getMemberJoinRules(serverId);

  if (rules.length === 0) return;

  for (const rule of rules) {
    try {
      await executeMemberJoinRule(rule, member.user, userId, serverId, serverName);
    } catch (error) {
      console.error(`[ServerMemberJoin] Erro ao executar a regra "${rule.name}":`, error);
    }
  }
}
