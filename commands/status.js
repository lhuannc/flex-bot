import * as databaseService from '../services/databaseService.js';
import * as ruleService from '../services/ruleService.js';

/**
 * Uso: !status
 */
export const name = 'status';
export const description = 'Exibe o status do FlexBot e estatísticas de validação.';
export const usage = 'status';

export async function execute({ message }) {
  const totalMatriculas = databaseService.getMatriculas().length;
  const rules = ruleService.getRules();
  const totalRegras = rules.length;
  const regrasAtivas = rules.filter(r => r.active).length;

  const descricao = [
    '**🟢 Status:** Online e Operacional',
    `**📋 Matrículas Autorizadas:** ${totalMatriculas}`,
    `**⚙️ Regras de Canais:** ${regrasAtivas} / ${totalRegras}`,
    `**🌐 Dashboard Web:** http://localhost:${process.env.PORT || 3000}`
  ].join('\n');

  // Embeds do Stoat aceitam apenas title/description/colour/url/icon_url/media
  await message.reply({
    embeds: [
      {
        title: '🤖 Status do FlexBot · Prefeitura do Rio 2025',
        description: descricao,
        colour: '#13335a'
      }
    ]
  });
}
