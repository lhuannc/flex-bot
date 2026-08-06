const fs = require('fs');
const path = require('path');

const DM_RULES_FILE = path.join(__dirname, '../data/dm_rules.json');

/**
 * Garante a existência do arquivo de regras de DM e URA Multi-Nível
 */
function ensureFileExists() {
  try {
    const dir = path.dirname(DM_RULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DM_RULES_FILE)) {
      const defaultDMRules = {
        greeting: {
          enabled: true,
          message: '👋 **Olá {user}! Seja bem-vindo(a) ao FlexBot.**\n\nPor favor, escolha uma das opções do menu abaixo digitando o número correspondente:'
        },
        ivrTree: [
          {
            id: 'opt-1',
            trigger: '1',
            label: '1 - Validação de Matrícula para Cargo de Acesso',
            consequences: {
              sendMessage: false,
              responseMessage: '',
              assignRole: false,
              roleId: process.env.ROLE_ID || '',
              requestMatricula: true,
              promptMessage: 'Por favor, digite seu número de matrícula oficial de 8 dígitos:'
            }
          }
        ]
      };
      fs.writeFileSync(DM_RULES_FILE, JSON.stringify(defaultDMRules, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[dmRuleService] Erro ao verificar/criar dm_rules.json:', err);
  }
}

/**
 * Obtém as regras de DM e árvore de URA
 */
function getDMRules() {
  try {
    ensureFileExists();
    const data = fs.readFileSync(DM_RULES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[dmRuleService] Erro ao ler regras de DM:', error);
    return { greeting: { enabled: true, message: '' }, ivrTree: [] };
  }
}

/**
 * Salva as regras de DM e árvore de URA
 */
function saveDMRules(data) {
  try {
    ensureFileExists();
    fs.writeFileSync(DM_RULES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[dmRuleService] Erro ao salvar dm_rules.json no disco:', err);
  }
}

module.exports = {
  getDMRules,
  saveDMRules
};
