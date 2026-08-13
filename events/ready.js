import * as stoatService from '../services/stoatService.js';

export const name = 'ready';
export const once = true;

/**
 * O evento `ready` do stoat.js não recebe argumentos; o carregador de eventos
 * injeta o cliente como último parâmetro.
 * @param {import('stoat.js').Client} client
 */
export async function execute(client) {
  stoatService.setClient(client);
  stoatService.setReady(true);

  const servers = client.servers.toList();
  console.log(`[Event Ready] Bot conectado com sucesso no Stoat como: ${client.user?.username}`);
  console.log(`[Event Ready] Servidores conectados: ${servers.length ? servers.map(s => s.name).join(', ') : 'nenhum'}`);

  // Define o status/presença do bot no Stoat
  const prefix = process.env.COMMAND_PREFIX || '!';
  try {
    await client.user?.edit({
      status: {
        text: `Validação de Matrículas | ${prefix}matricula`,
        presence: 'Online'
      }
    });
  } catch (error) {
    console.warn('[Event Ready] Não foi possível definir o status do bot:', error.message);
  }
}
