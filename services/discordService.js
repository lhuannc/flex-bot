/**
 * Serviço auxiliar para gerenciar ações do Bot no Discord (atribuição de cargos, busca de guildas, canais e envio de DMs)
 */

let discordClient = null;

/**
 * Registra o cliente ativo do Discord.js
 */
function setClient(client) {
  discordClient = client;
}

/**
 * Retorna o cliente do Discord.js
 */
function getClient() {
  return discordClient;
}

/**
 * Obtém uma guilda (servidor) por ID ou a guilda principal do .env / cache conectado
 * @param {string} [guildId] 
 */
async function getGuild(guildId = null) {
  if (!discordClient) return null;
  let targetGuildId = guildId || process.env.GUILD_ID;

  // Se nenhum GUILD_ID foi passado ou configurado no .env, pega o primeiro servidor onde o bot está instalado
  if (!targetGuildId || targetGuildId.trim() === '') {
    const firstGuild = discordClient.guilds.cache.first();
    if (firstGuild) return firstGuild;
    return null;
  }

  try {
    return await discordClient.guilds.fetch(targetGuildId);
  } catch (error) {
    console.warn(`[discordService] Aviso ao buscar Guild (${targetGuildId}), usando servidor conectado padrão:`, error.message);
    const firstGuild = discordClient.guilds.cache.first();
    if (firstGuild) return firstGuild;
    return null;
  }
}

/**
 * Lista todas as guildas (servidores) às quais o bot pertence
 */
async function getGuilds() {
  if (!discordClient || !discordClient.readyAt) return [];

  try {
    const guilds = await discordClient.guilds.fetch();
    const list = [];
    for (const [id, oauthGuild] of guilds) {
      const fullGuild = await oauthGuild.fetch().catch(() => null);
      list.push({
        id: id,
        name: oauthGuild.name,
        icon: oauthGuild.iconURL() || null,
        memberCount: fullGuild ? fullGuild.memberCount : 0
      });
    }
    return list;
  } catch (error) {
    console.error('[discordService] Erro ao listar servidores (guilds):', error);
    return [];
  }
}

/**
 * Lista todos os cargos (roles) de uma guilda específica
 * @param {string} guildId 
 */
async function getGuildRoles(guildId = null) {
  const guild = await getGuild(guildId);
  if (!guild) return [];

  try {
    const roles = await guild.roles.fetch();
    return roles.map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor
    })).filter(r => r.name !== '@everyone');
  } catch (error) {
    console.error(`[discordService] Erro ao listar cargos da guilda ${guildId}:`, error);
    return [];
  }
}

/**
 * Lista todos os canais de texto de uma guilda específica
 * @param {string} guildId 
 */
async function getGuildChannels(guildId = null) {
  const guild = await getGuild(guildId);
  if (!guild) return [];

  try {
    const channels = await guild.channels.fetch();
    return channels
      .filter(c => c && c.type === 0) // 0 = GuildText
      .map(c => ({
        id: c.id,
        name: c.name
      }));
  } catch (error) {
    console.error(`[discordService] Erro ao listar canais da guilda ${guildId}:`, error);
    return [];
  }
}

/**
 * Atribui uma Role (cargo) a um usuário no servidor especificado
 * @param {string} userId - ID do usuário no Discord
 * @param {string} roleId - ID da Role no Discord
 * @param {string} [guildId] - ID da Guilda (servidor)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function assignRoleToUser(userId, roleId, guildId = null) {
  if (!discordClient) {
    return { success: false, message: 'Cliente do Discord não inicializado.' };
  }

  const effectiveRoleId = roleId || process.env.ROLE_ID;
  if (!effectiveRoleId) {
    return { success: false, message: 'Nenhum cargo (ROLE_ID) foi especificado.' };
  }

  try {
    const guild = await getGuild(guildId);
    if (!guild) {
      return { success: false, message: `Servidor não foi encontrado pelo bot.` };
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return { success: false, message: `Usuário não encontrado no servidor "${guild.name}".` };
    }

    const role = await guild.roles.fetch(effectiveRoleId).catch(() => null);
    if (!role) {
      return { success: false, message: `Cargo com ID ${effectiveRoleId} não existe no servidor "${guild.name}".` };
    }

    await member.roles.add(role);
    return { success: true, message: `Cargo "${role.name}" atribuído no servidor "${guild.name}".` };
  } catch (error) {
    console.error('[discordService] Erro ao atribuir cargo:', error);
    return { success: false, message: `Falha ao atribuir cargo: ${error.message}` };
  }
}

/**
 * Envia uma mensagem direta (DM) para um usuário
 * @param {string} userId - ID do usuário no Discord
 * @param {string} messageContent - Texto da mensagem
 */
async function sendDMToUser(userId, messageContent) {
  if (!discordClient) {
    return { success: false, message: 'Cliente do Discord não inicializado.' };
  }

  try {
    const user = await discordClient.users.fetch(userId);
    if (!user) {
      return { success: false, message: 'Usuário do Discord não encontrado.' };
    }

    await user.send(messageContent);
    return { success: true, message: `Mensagem enviada com sucesso para ${user.tag}!` };
  } catch (error) {
    console.error('[discordService] Erro ao enviar DM:', error);
    return { success: false, message: `Erro ao enviar DM (DMs do usuário podem estar fechadas): ${error.message}` };
  }
}

/**
 * Dispara uma mensagem em massa para todos os membros que JÁ ESTÃO no servidor
 * @param {string} [guildId] 
 * @param {string} messageTemplate 
 */
async function broadcastToExistingMembers(guildId = null, messageTemplate) {
  if (!discordClient) {
    return { success: false, message: 'Cliente do Discord não inicializado.' };
  }

  const guild = await getGuild(guildId);
  if (!guild) {
    return { success: false, message: 'Servidor não encontrado.' };
  }

  try {
    const members = await guild.members.fetch();
    const humanMembers = members.filter(m => !m.user.bot);

    let sentCount = 0;
    let failedCount = 0;

    for (const [id, member] of humanMembers) {
      const msg = messageTemplate
        .replace(/\{user\}/g, `<@${id}>`)
        .replace(/\{server\}/g, guild.name);

      try {
        await member.send(msg);
        sentCount++;
      } catch (err) {
        failedCount++;
      }

      // Delay de 1.2s entre envios para respeitar o Rate-limit do Discord
      await new Promise(res => setTimeout(res, 1200));
    }

    return {
      success: true,
      message: `🎉 Disparo concluído! ${sentCount} DMs enviadas aos membros atuais (${failedCount} falhas devido a DMs fechadas).`,
      sentCount,
      failedCount
    };
  } catch (error) {
    console.error('[discordService] Erro no broadcast para membros existentes:', error);
    return { success: false, message: `Erro durante o disparo: ${error.message}` };
  }
}

module.exports = {
  setClient,
  getClient,
  getGuild,
  getGuilds,
  getGuildRoles,
  getGuildChannels,
  assignRoleToUser,
  sendDMToUser,
  broadcastToExistingMembers
};
