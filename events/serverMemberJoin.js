import * as dmTriggerService from '../services/dmTriggerService.js';
import * as stoatService from '../services/stoatService.js';

export const name = 'serverMemberJoin';

/**
 * Dispara a DM de boas-vindas quando um novo membro entra no servidor do Stoat.
 * @param {import('stoat.js').ServerMember} member
 */
export async function execute(member) {
  const serverName = member.server?.name || 'servidor';
  const userId = member.id.user;

  console.log(`[Event ServerMemberJoin] Novo membro entrou no servidor ${serverName}: ${member.user?.username} (${userId})`);

  const triggers = dmTriggerService.getDMTriggers();

  if (triggers.serverJoin && triggers.serverJoin.enabled) {
    const rawMessage = triggers.serverJoin.message || '👋 **Seja bem-vindo(a) ao nosso servidor!**\n\nPor favor envie sua **matrícula de 8 dígitos** nesta mensagem direta para liberar seu cargo de acesso.';

    const formattedMessage = rawMessage
      .replace(/\{user\}/g, `<@${userId}>`)
      .replace(/\{server\}/g, serverName);

    const delivered = member.user
      ? await stoatService.sendDMToStoatUser(member.user, formattedMessage)
      : false;

    if (delivered) {
      console.log(`[Event ServerMemberJoin] DM de boas-vindas enviada com sucesso para ${member.user?.username}`);
    } else {
      console.warn(`[Event ServerMemberJoin] Não foi possível enviar DM para ${member.user?.username} (DMs bloqueadas pelo usuário).`);
    }
  }
}
