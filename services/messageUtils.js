/**
 * Utilitários de manipulação de mensagens no Stoat.
 *
 * Falhas de deleção são quase sempre causadas por falta da permissão
 * `ManageMessages` no cargo do bot — por isso elas são SEMPRE registradas
 * no log, nunca engolidas silenciosamente.
 */

/**
 * Converte erros da API do Stoat (que são objetos simples, não instâncias de Error)
 * em texto legível para o log.
 */
export function describeError(error) {
  if (!error) return 'erro desconhecido';
  if (error.message) return error.message;
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Apaga uma mensagem registrando o motivo em caso de falha
 * @param {import('stoat.js').Message} message
 * @param {string} context - Descrição de onde a deleção foi solicitada (para o log)
 * @returns {Promise<boolean>} true se a mensagem foi apagada
 */
export async function deleteMessage(message, context = '') {
  if (!message) return false;

  try {
    await message.delete();
    return true;
  } catch (error) {
    const description = describeError(error);
    const suffix = context ? ` (${context})` : '';

    if (description.includes('MissingPermission')) {
      console.warn(
        `[messageUtils] Não foi possível apagar a mensagem${suffix}: o bot não possui a permissão ` +
        `"Gerenciar Mensagens" (ManageMessages) neste canal. Ajuste o cargo do bot nas configurações do servidor.`
      );
    } else {
      console.warn(`[messageUtils] Falha ao apagar a mensagem${suffix}: ${description}`);
    }
    return false;
  }
}

/**
 * Agenda a auto-deleção de uma mensagem após N segundos (0 = permanente)
 * @param {import('stoat.js').Message} message
 * @param {number} delaySeconds
 * @param {string} context
 */
export function scheduleDeletion(message, delaySeconds, context = '') {
  if (!message || delaySeconds <= 0) return;
  setTimeout(() => {
    deleteMessage(message, context || `auto-deleção após ${delaySeconds}s`);
  }, delaySeconds * 1000);
}
