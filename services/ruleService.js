const fs = require('fs');
const path = require('path');
const databaseService = require('./databaseService');

const RULES_FILE = path.join(__dirname, '../data/rules.json');
const WELCOME_FILE = path.join(__dirname, '../data/welcome.json');

/**
 * Garante a existência dos arquivos de configuração
 */
function ensureRulesFileExists() {
  try {
    const dir = path.dirname(RULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(RULES_FILE)) {
      const defaultRules = [
        {
          id: 'rule-' + Date.now(),
          name: 'Validação Principal de Matrícula',
          description: 'Valida matrículas de 8 dígitos presentes na base oficial.',
          matchType: 'DATABASE',
          triggerValue: '',
          guildId: process.env.GUILD_ID || '',
          roleId: process.env.ROLE_ID || '',
          allowedChannelId: process.env.ALLOWED_CHANNEL_ID || '',
          allowedChannels: process.env.ALLOWED_CHANNEL_ID ? [process.env.ALLOWED_CHANNEL_ID] : [],
          blacklistedChannels: [],
          allowedRoles: [],
          blacklistedRoles: [],
          enableDM: true,
          isIVR: false,
          deleteDelaySeconds: 10,
          ivrOptions: [],
          welcomeMessage: '👋 **Olá! Seja bem-vindo ao servidor.**\n\nPor favor, envie sua matrícula oficial para validar seu acesso:',
          successMessage: '✅ **Acesso Liberado!** {user}, sua matrícula foi validada e seu cargo {role} foi atribuído.',
          errorMessage: '❌ {user}: **Matrícula não encontrada.** Verifique os 8 números digitados.',
          active: true
        }
      ];
      fs.writeFileSync(RULES_FILE, JSON.stringify(defaultRules, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[ruleService] Erro ao verificar/criar rules.json:', err);
  }
}

/**
 * Garante a existência das configurações de boas-vindas
 */
function ensureWelcomeFileExists() {
  try {
    const dir = path.dirname(WELCOME_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(WELCOME_FILE)) {
      const defaultWelcome = {
        enabled: true,
        sendDM: true,
        message: '👋 **Seja bem-vindo(a) ao nosso servidor!**\n\nPara liberar o seu acesso aos canais exclusivos, por favor responda a esta mensagem enviando sua **matrícula de 8 dígitos**!'
      };
      fs.writeFileSync(WELCOME_FILE, JSON.stringify(defaultWelcome, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[ruleService] Erro ao verificar/criar welcome.json:', err);
  }
}

/**
 * Retorna todas as regras cadastradas
 */
function getRules() {
  try {
    ensureRulesFileExists();
    const data = fs.readFileSync(RULES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[ruleService] Erro ao ler regras:', error);
    return [];
  }
}

/**
 * Salva a lista de regras no JSON
 */
function saveRules(rules) {
  try {
    ensureRulesFileExists();
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ruleService] Erro ao salvar regras no disco:', err);
  }
}

/**
 * Retorna as configurações de Boas-Vindas
 */
function getWelcomeSettings() {
  try {
    ensureWelcomeFileExists();
    const data = fs.readFileSync(WELCOME_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { enabled: false, sendDM: true, message: '' };
  }
}

/**
 * Salva as configurações de Boas-Vindas
 */
function saveWelcomeSettings(settings) {
  try {
    ensureWelcomeFileExists();
    fs.writeFileSync(WELCOME_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ruleService] Erro ao salvar welcome.json no disco:', err);
  }
}

/**
 * Cria uma nova regra
 */
function createRule(ruleData) {
  const rules = getRules();
  const newRule = {
    id: 'rule-' + Date.now(),
    name: ruleData.name || 'Nova Regra de Matrícula',
    description: ruleData.description || '',
    matchType: 'DATABASE',
    triggerValue: '',
    guildId: ruleData.guildId || process.env.GUILD_ID || '',
    roleId: ruleData.roleId || '',
    allowedChannelId: ruleData.allowedChannelId || '',
    allowedChannels: ruleData.allowedChannelId ? [ruleData.allowedChannelId] : [],
    blacklistedChannels: [],
    allowedRoles: [],
    blacklistedRoles: [],
    enableDM: ruleData.enableDM !== false,
    isIVR: ruleData.isIVR === true,
    deleteDelaySeconds: typeof ruleData.deleteDelaySeconds === 'number' ? ruleData.deleteDelaySeconds : 10,
    ivrOptions: Array.isArray(ruleData.ivrOptions) ? ruleData.ivrOptions : [],
    welcomeMessage: ruleData.welcomeMessage || '',
    successMessage: ruleData.successMessage || '✅ Acesso liberado! {user}, sua matrícula foi validada.',
    errorMessage: ruleData.errorMessage || '❌ {user}: Matrícula não encontrada.',
    active: ruleData.active !== false
  };

  rules.push(newRule);
  saveRules(rules);
  return newRule;
}

/**
 * Atualiza uma regra existente por ID
 */
function updateRule(id, updatedFields) {
  const rules = getRules();
  const index = rules.findIndex(r => r.id === id);
  if (index === -1) return null;

  rules[index] = {
    ...rules[index],
    ...updatedFields,
    deleteDelaySeconds: typeof updatedFields.deleteDelaySeconds === 'number' ? updatedFields.deleteDelaySeconds : (rules[index].deleteDelaySeconds ?? 10),
    matchType: 'DATABASE',
    id
  };

  saveRules(rules);
  return rules[index];
}

/**
 * Deleta uma regra por ID
 */
function deleteRule(id) {
  let rules = getRules();
  const initialLength = rules.length;
  rules = rules.filter(r => r.id !== id);

  if (rules.length === initialLength) return false;

  saveRules(rules);
  return true;
}

/**
 * Avalia se uma entrada existe na base de dados de matrículas (matriculas.json)
 */
function evaluateMatch(input) {
  if (!input) return { success: false };
  const cleanInput = String(input).trim();
  return { success: databaseService.validarMatricula(cleanInput) };
}

/**
 * Avalia uma requisição de comando/mensagem contra todas as regras ativas
 */
function evaluateRules(code, channelId = null, isDM = false, guildId = null, userRoleIds = []) {
  const rules = getRules().filter(r => r.active);

  for (const rule of rules) {
    // 1. Validar Guild
    if (!isDM && guildId && rule.guildId && rule.guildId !== guildId) {
      continue;
    }

    // 2. Validar se permite DM
    if (isDM && !rule.enableDM) {
      continue;
    }

    // 3. Validar Canal Específico (se configurado)
    if (!isDM && rule.allowedChannelId && rule.allowedChannelId.trim() !== '') {
      const allowedChannels = rule.allowedChannelId.split(',').map(c => c.trim());
      if (channelId && !allowedChannels.includes(channelId)) {
        return {
          matchedRule: rule,
          success: false,
          isChannelInvalid: true,
          message: '⚠️ Este comando só pode ser utilizado no canal de validação oficial autorizados nesta regra.'
        };
      }
    }

    // 4. Validar se a matrícula existe no matriculas.json
    const matchResult = evaluateMatch(code);

    if (matchResult.success) {
      return {
        matchedRule: rule,
        success: true,
        isChannelInvalid: false,
        guildIdToAssign: rule.guildId || guildId || process.env.GUILD_ID,
        roleIdToAssign: rule.roleId || process.env.ROLE_ID,
        message: rule.successMessage
      };
    } else {
      return {
        matchedRule: rule,
        success: false,
        isChannelInvalid: false,
        message: rule.errorMessage
      };
    }
  }

  return {
    matchedRule: null,
    success: false,
    isChannelInvalid: false,
    message: '❌ Matrícula não encontrada.'
  };
}

module.exports = {
  getRules,
  saveRules,
  getWelcomeSettings,
  saveWelcomeSettings,
  createRule,
  updateRule,
  deleteRule,
  evaluateMatch,
  evaluateRules
};
