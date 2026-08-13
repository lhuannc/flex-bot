/**
 * Serviço auxiliar para gerenciar as ações do Bot no Stoat
 * (atribuição de cargos, busca de servidores, canais e envio de mensagens diretas).
 *
 * Toda a comunicação com a plataforma passa por aqui: nenhum outro módulo importa
 * o `stoat.js` diretamente. Isso mantém o motor de URA e as regras 100% agnósticos.
 */

import { describeError } from './messageUtils.js';

/** @type {import('stoat.js').Client | null} */
let stoatClient = null;
let clientReady = false;

/**
 * Registra o cliente ativo do stoat.js
 */
export function setClient(client) {
  stoatClient = client;
}

/**
 * Retorna o cliente do stoat.js
 */
export function getClient() {
  return stoatClient;
}

/**
 * Marca o cliente como conectado/desconectado (usado pelos eventos ready/disconnected)
 */
export function setReady(state) {
  clientReady = !!state;
}

/**
 * Indica se o bot está conectado e autenticado no Stoat
 */
export function isReady() {
  return clientReady && !!stoatClient?.user;
}

/**
 * Obtém um servidor por ID, ou o servidor padrão do .env, ou o primeiro servidor conectado
 * @param {string|null} serverId
 * @returns {Promise<import('stoat.js').Server | null>}
 */
export async function getServer(serverId = null) {
  if (!stoatClient) return null;

  const targetServerId = serverId || process.env.SERVER_ID;

  // Sem ID definido: usa o primeiro servidor onde o bot foi adicionado
  if (!targetServerId || targetServerId.trim() === '') {
    return stoatClient.servers.toList()[0] ?? null;
  }

  const cached = stoatClient.servers.get(targetServerId);
  if (cached) return cached;

  try {
    return await stoatClient.servers.fetch(targetServerId);
  } catch (error) {
    console.warn(`[stoatService] Aviso ao buscar o servidor (${targetServerId}), usando o servidor conectado padrão: ${describeError(error)}`);
    return stoatClient.servers.toList()[0] ?? null;
  }
}

/**
 * Lista todos os servidores aos quais o bot pertence
 */
export async function getServers() {
  if (!isReady()) return [];

  try {
    return stoatClient.servers.toList().map(server => ({
      id: server.id,
      name: server.name,
      icon: server.iconURL ?? null
    }));
  } catch (error) {
    console.error('[stoatService] Erro ao listar servidores:', error);
    return [];
  }
}

/**
 * Lista todos os cargos (roles) de um servidor específico
 * @param {string} serverId
 */
export async function getServerRoles(serverId = null) {
  const server = await getServer(serverId);
  if (!server) return [];

  try {
    return [...server.roles.values()]
      .sort((a, b) => a.rank - b.rank)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.colour ?? null
      }));
  } catch (error) {
    console.error(`[stoatService] Erro ao listar cargos do servidor ${serverId}:`, error);
    return [];
  }
}

/**
 * Lista todos os canais de texto de um servidor específico
 * @param {string} serverId
 */
export async function getServerChannels(serverId = null) {
  const server = await getServer(serverId);
  if (!server) return [];

  try {
    return server.channels
      .filter(channel => channel && channel.type === 'TextChannel')
      .map(channel => ({
        id: channel.id,
        name: channel.name
      }));
  } catch (error) {
    console.error(`[stoatService] Erro ao listar canais do servidor ${serverId}:`, error);
    return [];
  }
}

/**
 * Busca um cargo pelo ID dentro de um servidor
 * @param {string} roleId
 * @param {string} [serverId]
 * @returns {Promise<{id: string, name: string} | null>}
 */
export async function getRoleById(roleId, serverId = null) {
  if (!roleId) return null;
  const server = await getServer(serverId);
  const role = server?.roles.get(roleId);
  return role ? { id: role.id, name: role.name } : null;
}

/**
 * Atribui um cargo (role) a um usuário no servidor especificado.
 *
 * A API do Stoat substitui a lista inteira de cargos do membro no PATCH,
 * portanto os cargos atuais são mesclados antes do envio.
 *
 * @param {string} userId - ID do usuário no Stoat
 * @param {string} roleId - ID do cargo no Stoat
 * @param {string} [serverId] - ID do servidor
 * @returns {Promise<{success: boolean, message: string, roleName?: string}>}
 */
export async function assignRoleToUser(userId, roleId, serverId = null) {
  if (!stoatClient) {
    return { success: false, message: 'Cliente do Stoat não inicializado.' };
  }

  const effectiveRoleId = roleId || process.env.ROLE_ID;
  if (!effectiveRoleId) {
    return { success: false, message: 'Nenhum cargo (ROLE_ID) foi especificado.' };
  }

  try {
    const server = await getServer(serverId);
    if (!server) {
      return { success: false, message: 'Servidor não foi encontrado pelo bot.' };
    }

    const role = server.roles.get(effectiveRoleId);
    if (!role) {
      return { success: false, message: `Cargo com ID ${effectiveRoleId} não existe no servidor "${server.name}".` };
    }

    const member = await server.fetchMember(userId).catch(() => null);
    if (!member) {
      return { success: false, message: `Usuário não encontrado no servidor "${server.name}".` };
    }

    const currentRoles = member.roles ?? [];
    if (currentRoles.includes(effectiveRoleId)) {
      return { success: true, message: `O usuário já possuía o cargo "${role.name}".`, roleName: role.name };
    }

    await member.edit({ roles: [...new Set([...currentRoles, effectiveRoleId])] });

    return {
      success: true,
      message: `Cargo "${role.name}" atribuído no servidor "${server.name}".`,
      roleName: role.name
    };
  } catch (error) {
    const description = describeError(error);

    // Causa mais comum: o cargo do bot não tem "AssignRoles" ou está abaixo
    // (rank maior) do cargo que ele tenta conceder.
    if (description.includes('MissingPermission')) {
      console.error(
        `[stoatService] Não foi possível atribuir o cargo: o bot não possui a permissão "Atribuir Cargos" ` +
        `(AssignRoles), ou o cargo dele está posicionado ABAIXO do cargo alvo na hierarquia do servidor. ` +
        `Detalhe da API: ${description}`
      );
      return { success: false, message: 'O bot não tem permissão "Atribuir Cargos" ou seu cargo está abaixo do cargo alvo na hierarquia.' };
    }

    console.error(`[stoatService] Erro ao atribuir cargo: ${description}`);
    return { success: false, message: `Falha ao atribuir cargo: ${description}` };
  }
}

/**
 * Abre (ou reutiliza) o canal de mensagem direta com um objeto User do Stoat
 * @param {import('stoat.js').User} user
 */
export async function openDMChannel(user) {
  if (!user) return null;
  try {
    return await user.openDM();
  } catch (error) {
    console.warn(`[stoatService] Não foi possível abrir DM com ${user.username}: ${describeError(error)}`);
    return null;
  }
}

/**
 * Envia uma mensagem direta (DM) para um objeto User já resolvido
 * @param {import('stoat.js').User} user
 * @param {string} content
 */
export async function sendDMToStoatUser(user, content) {
  const dmChannel = await openDMChannel(user);
  if (!dmChannel) return false;

  try {
    await dmChannel.sendMessage(content);
    return true;
  } catch (error) {
    console.warn(`[stoatService] Falha ao enviar DM para ${user.username}: ${describeError(error)}`);
    return false;
  }
}

/**
 * Envia uma mensagem direta (DM) para um usuário a partir do seu ID
 * @param {string} userId - ID do usuário no Stoat
 * @param {string} messageContent - Texto da mensagem
 */
export async function sendDMToUser(userId, messageContent) {
  if (!stoatClient) {
    return { success: false, message: 'Cliente do Stoat não inicializado.' };
  }

  try {
    const user = stoatClient.users.get(userId) ?? await stoatClient.users.fetch(userId);
    if (!user) {
      return { success: false, message: 'Usuário do Stoat não encontrado.' };
    }

    const dmChannel = await user.openDM();
    await dmChannel.sendMessage(messageContent);

    return { success: true, message: `Mensagem enviada com sucesso para ${user.displayName || user.username}!` };
  } catch (error) {
    const description = describeError(error);
    console.error(`[stoatService] Erro ao enviar DM: ${description}`);
    return { success: false, message: `Erro ao enviar DM (o usuário pode ter bloqueado mensagens diretas): ${description}` };
  }
}

/**
 * Dispara uma mensagem em massa para todos os membros que JÁ ESTÃO no servidor
 * @param {string} [serverId]
 * @param {string} messageTemplate
 */
export async function broadcastToExistingMembers(serverId = null, messageTemplate) {
  if (!stoatClient) {
    return { success: false, message: 'Cliente do Stoat não inicializado.' };
  }

  const server = await getServer(serverId);
  if (!server) {
    return { success: false, message: 'Servidor não encontrado.' };
  }

  try {
    const { members } = await server.fetchMembers();
    const humanMembers = members.filter(member => !member.user?.bot);

    let sentCount = 0;
    let failedCount = 0;

    for (const member of humanMembers) {
      const msg = messageTemplate
        .replace(/\{user\}/g, `<@${member.id.user}>`)
        .replace(/\{server\}/g, server.name);

      const delivered = member.user ? await sendDMToStoatUser(member.user, msg) : false;
      if (delivered) sentCount++;
      else failedCount++;

      // Delay de 1.2s entre envios para respeitar o rate-limit do Stoat
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    return {
      success: true,
      message: `🎉 Disparo concluído! ${sentCount} DMs enviadas aos membros atuais (${failedCount} falhas por DMs bloqueadas).`,
      sentCount,
      failedCount
    };
  } catch (error) {
    console.error('[stoatService] Erro no broadcast para membros existentes:', error);
    return { success: false, message: `Erro durante o disparo: ${error.message}` };
  }
}
