import fs from 'node:fs';
import path from 'node:path';

const TRIGGERS_FILE = path.join(import.meta.dirname, '../data/dm_triggers.json');

/**
 * Garante a existência do arquivo de gatilhos de DM
 */
function ensureFileExists() {
  try {
    const dir = path.dirname(TRIGGERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(TRIGGERS_FILE)) {
      const defaultTriggers = {
        serverJoin: {
          enabled: true,
          message: '👋 **Olá {user}! Seja bem-vindo(a) pela primeira vez ao servidor {server}!**\n\nPor favor, envie sua **matrícula de 8 dígitos** aqui nesta conversa privada para liberar seu cargo de acesso.'
        },
        existingMembersBroadcast: {
          enabled: true,
          message: '📢 **Olá {user}! Comunicado Oficial da Prefeitura do Rio - Servidor {server}.**\n\nPara atualizar e validar seu acesso corporativo aos canais, por favor responda a esta mensagem enviando sua **matrícula de 8 dígitos**.'
        },
        keywordGreeting: {
          enabled: true,
          keywords: ['oi', 'olá', 'ola', 'ajuda', 'matricula', 'matrícula', 'menu', 'iniciar', 'bom dia', 'boa tarde', 'boa noite'],
          message: '👋 **Olá {user}! Eu sou o FlexBot.**\n\nPor favor, digite o número da sua **matrícula de 8 dígitos** aqui nesta conversa para validar seu acesso aos canais do servidor.'
        }
      };
      fs.writeFileSync(TRIGGERS_FILE, JSON.stringify(defaultTriggers, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[dmTriggerService] Erro ao verificar/criar dm_triggers.json:', err);
  }
}

/**
 * Obtém as configurações dos gatilhos de DM
 */
export function getDMTriggers() {
  try {
    ensureFileExists();
    const data = fs.readFileSync(TRIGGERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[dmTriggerService] Erro ao ler gatilhos de DM:', error);
    return {};
  }
}

/**
 * Salva as configurações dos gatilhos de DM
 */
export function saveDMTriggers(triggers) {
  try {
    ensureFileExists();
    fs.writeFileSync(TRIGGERS_FILE, JSON.stringify(triggers, null, 2), 'utf-8');
  } catch (err) {
    console.error('[dmTriggerService] Erro ao salvar dm_triggers.json no disco:', err);
  }
}

/**
 * Verifica se a mensagem na DM combina com alguma palavra-chave de saudação
 */
export function isKeywordMatch(content) {
  if (!content) return false;
  const config = getDMTriggers();
  if (!config.keywordGreeting || !config.keywordGreeting.enabled) return false;

  const text = String(content).trim().toLowerCase();
  const keywords = config.keywordGreeting.keywords || [];

  return keywords.some(kw => text === kw.toLowerCase() || text.startsWith(kw.toLowerCase() + ' '));
}
