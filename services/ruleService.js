import fs from 'node:fs';
import path from 'node:path';
import * as databaseService from './databaseService.js';

const RULES_FILE = path.join(import.meta.dirname, '../data/rules.json');
const WELCOME_FILE = path.join(import.meta.dirname, '../data/welcome.json');

/**
 * Normaliza uma regra vinda do disco.
 * Regras gravadas pela versão Discord do FlexBot usavam o campo `guildId`;
 * no Stoat o conceito equivalente chama-se "servidor" (`serverId`).
 */
function normalizeRule(rule) {
  if (!rule || typeof rule !== 'object') return rule;

  const { guildId, ...rest } = rule;
  return {
    ...rest,
    serverId: rule.serverId || guildId || '',
    usedMessage: rule.usedMessage || DEFAULT_USED_MESSAGE,
    // QUANDO: gatilho único da regra. Regras antigas (sem o campo) validam matrícula.
    triggerType: rule.triggerType === 'MEMBER_JOIN' ? 'MEMBER_JOIN' : 'MATRICULA',
    // ENTÃO: consequências combináveis. Ausentes = ligadas (comportamento anterior),
    // exceto a DM, que é novidade e nasce desligada em regras antigas.
    actions: {
      assignRole: rule.actions?.assignRole !== false,
      sendMessage: rule.actions?.sendMessage !== false,
      sendDM: rule.actions?.sendDM === true
    },
    dmMessage: rule.dmMessage || ''
  };
}

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
          serverId: process.env.SERVER_ID || '',
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
          usedMessage: '🚫 {user}: **Esta matrícula já foi utilizada.** Cada matrícula libera o acesso uma única vez.',
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
export function getRules() {
  try {
    ensureRulesFileExists();
    const data = fs.readFileSync(RULES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(normalizeRule) : [];
  } catch (error) {
    console.error('[ruleService] Erro ao ler regras:', error);
    return [];
  }
}

/**
 * Salva a lista de regras no JSON
 */
export function saveRules(rules) {
  try {
    ensureRulesFileExists();
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules.map(normalizeRule), null, 2), 'utf-8');
  } catch (err) {
    console.error('[ruleService] Erro ao salvar regras no disco:', err);
  }
}

/**
 * Retorna as configurações de Boas-Vindas
 */
export function getWelcomeSettings() {
  try {
    ensureWelcomeFileExists();
    const data = fs.readFileSync(WELCOME_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { enabled: false, sendDM: true, message: '' };
  }
}

/**
 * Salva as configurações de Boas-Vindas
 */
export function saveWelcomeSettings(settings) {
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
export function createRule(ruleData) {
  const rules = getRules();
  const newRule = {
    id: 'rule-' + Date.now(),
    name: ruleData.name || 'Nova Regra de Matrícula',
    description: ruleData.description || '',
    matchType: 'DATABASE',
    triggerValue: '',
    triggerType: ruleData.triggerType === 'MEMBER_JOIN' ? 'MEMBER_JOIN' : 'MATRICULA',
    actions: {
      assignRole: ruleData.actions?.assignRole !== false,
      sendMessage: ruleData.actions?.sendMessage !== false,
      sendDM: ruleData.actions?.sendDM === true
    },
    dmMessage: ruleData.dmMessage || '',
    serverId: ruleData.serverId || ruleData.guildId || process.env.SERVER_ID || '',
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
    usedMessage: ruleData.usedMessage || DEFAULT_USED_MESSAGE,
    active: ruleData.active !== false
  };

  rules.push(newRule);
  saveRules(rules);
  return newRule;
}

/**
 * Atualiza uma regra existente por ID
 */
export function updateRule(id, updatedFields) {
  const rules = getRules();
  const index = rules.findIndex(r => r.id === id);
  if (index === -1) return null;

  rules[index] = normalizeRule({
    ...rules[index],
    ...updatedFields,
    deleteDelaySeconds: typeof updatedFields.deleteDelaySeconds === 'number' ? updatedFields.deleteDelaySeconds : (rules[index].deleteDelaySeconds ?? 10),
    matchType: 'DATABASE',
    id
  });

  saveRules(rules);
  return rules[index];
}

/**
 * Deleta uma regra por ID
 */
export function deleteRule(id) {
  let rules = getRules();
  const initialLength = rules.length;
  rules = rules.filter(r => r.id !== id);

  if (rules.length === initialLength) return false;

  saveRules(rules);
  return true;
}

/**
 * Retorna as regras ativas cujo QUANDO é "Novos membros do servidor",
 * opcionalmente filtradas pelo servidor onde o membro entrou.
 * @param {string} [serverId]
 */
export function getMemberJoinRules(serverId = null) {
  return getRules().filter(rule => {
    if (!rule.active || rule.triggerType !== 'MEMBER_JOIN') return false;
    if (serverId && rule.serverId && rule.serverId !== serverId) return false;
    return true;
  });
}

/**
 * Mensagem padrão exibida quando a matrícula existe mas já foi consumida
 */
export const DEFAULT_USED_MESSAGE = '🚫 {user}: **Esta matrícula já foi utilizada.** Cada matrícula libera o acesso uma única vez. Procure o suporte caso precise de uma nova liberação.';

/**
 * Avalia se uma entrada existe na base de matrículas (matriculas.json)
 * e se ainda não foi consumida (matriculas_usos.json)
 * @returns {{ success: boolean, reason: 'NOT_FOUND'|'ALREADY_USED'|null, uso: object|null }}
 */
export function evaluateMatch(input) {
  if (!input) return { success: false, reason: 'NOT_FOUND', uso: null };

  const cleanInput = String(input).trim();
  const { existe, usada, uso } = databaseService.consultarMatricula(cleanInput);

  if (!existe) return { success: false, reason: 'NOT_FOUND', uso: null };
  if (usada) return { success: false, reason: 'ALREADY_USED', uso };

  return { success: true, reason: null, uso: null };
}

/**
 * Avalia uma requisição de comando/mensagem contra todas as regras ativas
 */
export function evaluateRules(code, channelId = null, isDM = false, serverId = null) {
  // Somente regras cujo QUANDO é "validar matrícula" participam desta avaliação
  const rules = getRules().filter(r => r.active && r.triggerType === 'MATRICULA');

  for (const rule of rules) {
    // 1. Validar Servidor
    if (!isDM && serverId && rule.serverId && rule.serverId !== serverId) {
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
          message: '⚠️ Este comando só pode ser utilizado no canal de validação oficial autorizado nesta regra.'
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
        alreadyUsed: false,
        serverIdToAssign: rule.serverId || serverId || process.env.SERVER_ID,
        roleIdToAssign: rule.roleId || process.env.ROLE_ID,
        message: rule.successMessage
      };
    }

    // 5. A matrícula existe, porém já foi consumida anteriormente
    if (matchResult.reason === 'ALREADY_USED') {
      return {
        matchedRule: rule,
        success: false,
        isChannelInvalid: false,
        alreadyUsed: true,
        uso: matchResult.uso,
        message: rule.usedMessage || DEFAULT_USED_MESSAGE
      };
    }

    return {
      matchedRule: rule,
      success: false,
      isChannelInvalid: false,
      alreadyUsed: false,
      message: rule.errorMessage
    };
  }

  // Nenhuma regra aplicável: ainda assim diferencia "já utilizada" de "não encontrada"
  const fallbackMatch = evaluateMatch(code);
  if (fallbackMatch.reason === 'ALREADY_USED') {
    return {
      matchedRule: null,
      success: false,
      isChannelInvalid: false,
      alreadyUsed: true,
      uso: fallbackMatch.uso,
      message: DEFAULT_USED_MESSAGE
    };
  }

  return {
    matchedRule: null,
    success: false,
    isChannelInvalid: false,
    alreadyUsed: false,
    message: '❌ Matrícula não encontrada.'
  };
}
