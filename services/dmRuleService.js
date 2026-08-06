const fs = require('fs');
const path = require('path');

const DM_RULES_FILE = path.join(__dirname, '../data/dm_rules.json');

/**
 * Garante a existência do arquivo de regras de DM e URA Multi-Nível
 */
function ensureFileExists() {
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
          actionType: 'MATRICULA_VALIDATION', // 'MATRICULA_VALIDATION' | 'SUBMENU' | 'MESSAGE_ONLY'
          promptMessage: 'Por favor, digite seu número de matrícula oficial de 8 dígitos:',
          roleId: process.env.ROLE_ID || '',
          guildId: process.env.GUILD_ID || '',
          suboptions: []
        },
        {
          id: 'opt-2',
          trigger: '2',
          label: '2 - Cursos e Categorias (Submenu)',
          actionType: 'SUBMENU',
          submenuPrompt: '📌 **Selecione a sua categoria:**',
          suboptions: [
            {
              id: 'opt-2-1',
              trigger: '1',
              label: '1 - Aluno de Graduação',
              actionType: 'MATRICULA_VALIDATION',
              promptMessage: 'Por favor, digite sua matrícula de Aluno de Graduação:',
              roleId: process.env.ROLE_ID || '',
              guildId: process.env.GUILD_ID || ''
            },
            {
              id: 'opt-2-2',
              trigger: '2',
              label: '2 - Aluno de Pós-Graduação',
              actionType: 'MATRICULA_VALIDATION',
              promptMessage: 'Por favor, digite sua matrícula de Pós-Graduação:',
              roleId: process.env.ROLE_ID || '',
              guildId: process.env.GUILD_ID || ''
            }
          ]
        },
        {
          id: 'opt-3',
          trigger: '3',
          label: '3 - Link do Canal de Dúvidas',
          actionType: 'MESSAGE_ONLY',
          responseMessage: '🔗 Acesse o canal oficial de dúvidas no nosso servidor: https://discord.com/'
        }
      ]
    };
    fs.writeFileSync(DM_RULES_FILE, JSON.stringify(defaultDMRules, null, 2));
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
  ensureFileExists();
  fs.writeFileSync(DM_RULES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  getDMRules,
  saveDMRules
};
