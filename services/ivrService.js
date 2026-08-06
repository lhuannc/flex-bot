const dmRuleService = require('./dmRuleService');
const ruleService = require('./ruleService');
const discordService = require('./discordService');

// Estado em memória das sessões ativas dos usuários na URA (userId -> sessionData)
const userSessions = new Map();

/**
 * Retorna a sessão ativa de um usuário ou cria uma nova
 */
function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      userId,
      step: 'ROOT', // 'ROOT' | 'SUBMENU' | 'AWAITING_MATRICULA'
      currentMenuOptions: [],
      pendingOption: null,
      updatedAt: Date.now()
    });
  }
  return userSessions.get(userId);
}

/**
 * Limpa a sessão de um usuário
 */
function clearSession(userId) {
  userSessions.delete(userId);
}

/**
 * Monta o texto de apresentação de uma lista de opções de URA
 */
function formatMenuText(title, options) {
  let text = `${title}\n\n`;
  options.forEach((opt, idx) => {
    const trigger = opt.trigger || `${idx + 1}`;
    text += `**${trigger}** - ${opt.label || `Opção ${trigger}`}\n`;
  });
  text += `\n*Digite apenas o número correspondente à opção desejada.*`;
  return text;
}

/**
 * Formata o modelo da mensagem substituindo variáveis {user} e {server}
 */
function formatTemplate(template, userId, guildName = '') {
  if (!template) return '';
  return template
    .replace(/\{user\}/g, `<@${userId}>`)
    .replace(/\{server\}/g, guildName);
}

/**
 * Processa mensagens recebidas via DM dentro do fluxo de URA com Consequências Flexíveis
 */
async function processIVRMessage(message) {
  const userId = message.author.id;
  const content = message.content.trim();
  const dmRules = dmRuleService.getDMRules();

  if (!dmRules.ivrTree || dmRules.ivrTree.length === 0) {
    return false; // Sem URA configurada
  }

  const session = getSession(userId);

  // ---------------------------------------------------------------------------
  // ETAPA 1: Usuário está aguardando digitação da Matrícula
  // ---------------------------------------------------------------------------
  if (session.step === 'AWAITING_MATRICULA' && session.pendingOption) {
    const pending = session.pendingOption;
    const cons = pending.consequences || pending;
    console.log(`[IVR Engine] Usuário ${userId} enviou matrícula "${content}" para a opção "${pending.label}"`);

    const result = ruleService.evaluateMatch(content);

    if (result.success) {
      const roleId = cons.roleId || pending.roleId || process.env.ROLE_ID;
      const targetGuildId = cons.guildId || pending.guildId || process.env.GUILD_ID;

      if (roleId) {
        const roleResult = await discordService.assignRoleToUser(userId, roleId, targetGuildId);
        if (roleResult.success) {
          await message.reply(`✅ **Acesso Liberado!** Sua matrícula **${content}** foi validada com sucesso e seu cargo foi atribuído.`);
        } else {
          await message.reply(`✅ **Matrícula Validada!** Ocorreu um pequeno aviso ao aplicar o cargo no servidor (${roleResult.message}).`);
        }
      } else {
        await message.reply(`✅ **Acesso Liberado!** Sua matrícula **${content}** foi validada.`);
      }

      // Se houver mensagem de sucesso customizada na opção
      if (cons.successMessage) {
        await message.channel.send(formatTemplate(cons.successMessage, userId));
      }

      // Se houver submenu subsequente
      if (cons.openSubmenu && Array.isArray(cons.suboptions) && cons.suboptions.length > 0) {
        session.step = 'SUBMENU';
        session.currentMenuOptions = cons.suboptions;
        session.submenuTitle = cons.submenuPrompt || `📌 **${pending.label}**`;
        session.pendingOption = null;
        await message.reply(formatMenuText(session.submenuTitle, cons.suboptions));
        return true;
      }

      clearSession(userId);
    } else {
      await message.reply(`❌ **Matrícula não encontrada.** Verifique os números digitados e tente novamente:`);
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // ETAPA 2: Navegação em Submenu Ativo
  // ---------------------------------------------------------------------------
  if (session.step === 'SUBMENU' && session.currentMenuOptions) {
    const matchedSub = session.currentMenuOptions.find(o => String(o.trigger) === content);

    if (matchedSub) {
      return await executeOptionConsequences(message, session, matchedSub);
    } else {
      await message.reply(`⚠️ **Opção inválida.** Por favor, digite o número de uma das opções do menu:\n\n${formatMenuText(session.submenuTitle || '📌 Selecione uma opção:', session.currentMenuOptions)}`);
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // ETAPA 3: Navegação no Menu Principal (ROOT)
  // ---------------------------------------------------------------------------
  const rootOption = dmRules.ivrTree.find(o => String(o.trigger) === content);

  if (rootOption) {
    return await executeOptionConsequences(message, session, rootOption);
  }

  // Se o comando/texto for uma palavra-chave ("oi", "menu", "ajuda"), exibe o menu principal
  const lowerContent = content.toLowerCase();
  if (['oi', 'olá', 'ola', 'ajuda', 'menu', 'iniciar', 'início'].includes(lowerContent)) {
    session.step = 'ROOT';
    session.pendingOption = null;
    const greetingTitle = dmRules.greeting?.message || '👋 **Seja bem-vindo(a) ao atendimento automatizado!**';
    await message.reply(formatMenuText(greetingTitle, dmRules.ivrTree));
    return true;
  }

  return false;
}

/**
 * Executa as Consequências Configuradas de uma Opção (Pode combinar: Mensagem + Cargo + Matrícula + Submenu)
 */
async function executeOptionConsequences(message, session, option) {
  const userId = message.author.id;
  
  // Suporta formato de consequências combináveis ou legado
  const cons = option.consequences || {
    sendMessage: option.actionType === 'MESSAGE_ONLY' || !!option.responseMessage,
    responseMessage: option.responseMessage,
    assignRole: option.actionType === 'MATRICULA_VALIDATION' && !!option.roleId && !option.requestMatricula,
    roleId: option.roleId,
    requestMatricula: option.actionType === 'MATRICULA_VALIDATION',
    promptMessage: option.promptMessage,
    openSubmenu: option.actionType === 'SUBMENU' || (Array.isArray(option.suboptions) && option.suboptions.length > 0),
    submenuPrompt: option.submenuPrompt,
    suboptions: option.suboptions
  };

  // 1. Consequência: ENVIAR MENSAGEM / RESPOSTA
  if (cons.sendMessage && cons.responseMessage) {
    await message.reply(formatTemplate(cons.responseMessage, userId));
  }

  // 2. Consequência: ATRIBUIR CARGO DIRETO (Sem precisar de validação prévia de matrícula se desativado)
  if (cons.assignRole && cons.roleId && !cons.requestMatricula) {
    const roleId = cons.roleId;
    const targetGuildId = cons.guildId || process.env.GUILD_ID;
    const roleResult = await discordService.assignRoleToUser(userId, roleId, targetGuildId);
    if (roleResult.success) {
      await message.channel.send(`🎉 **Cargo concedido!** O cargo foi atribuído ao seu usuário no servidor.`);
    }
  }

  // 3. Consequência: SOLICITAR VALIDAÇÃO DE MATRÍCULA
  if (cons.requestMatricula) {
    session.step = 'AWAITING_MATRICULA';
    session.pendingOption = option;
    await message.reply(cons.promptMessage || option.promptMessage || 'Por favor, digite seu número de matrícula oficial:');
    return true;
  }

  // 4. Consequência: ABRIR SUBMENU / NOVO NÍVEL DE OPÇÕES
  if (cons.openSubmenu && Array.isArray(cons.suboptions) && cons.suboptions.length > 0) {
    session.step = 'SUBMENU';
    session.currentMenuOptions = cons.suboptions;
    session.submenuTitle = cons.submenuPrompt || option.submenuPrompt || `📌 **${option.label}**`;
    session.pendingOption = null;

    await message.reply(formatMenuText(session.submenuTitle, cons.suboptions));
    return true;
  }

  // Se nenhuma ação pendente (Matrícula ou Submenu), finaliza a sessão
  if (!cons.requestMatricula && (!cons.openSubmenu || !cons.suboptions || cons.suboptions.length === 0)) {
    clearSession(userId);
  }

  return true;
}

/**
 * Envia o Menu Principal de URA para a DM de um usuário
 */
async function sendRootIVRMenu(user, titleOverride = '') {
  const dmRules = dmRuleService.getDMRules();
  if (!dmRules.ivrTree || dmRules.ivrTree.length === 0) return false;

  const session = getSession(user.id);
  session.step = 'ROOT';
  session.pendingOption = null;

  const title = titleOverride || dmRules.greeting?.message || '👋 **Seja bem-vindo(a)!**';
  const menuText = formatMenuText(title, dmRules.ivrTree);

  try {
    await user.send(menuText);
    return true;
  } catch (err) {
    console.warn(`[IVR Service] Não foi possível enviar menu URA para ${user.tag} (DMs fechadas).`);
    return false;
  }
}

module.exports = {
  processIVRMessage,
  sendRootIVRMenu,
  clearSession
};
