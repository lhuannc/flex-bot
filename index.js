import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from 'stoat.js';
import { createWebServer } from './web/server.js';
import * as stoatService from './services/stoatService.js';

// 1. Criação do cliente do Stoat
// O baseURL permite apontar tanto para a instância oficial (https://stoat.chat/api)
// quanto para uma instância self-hosted do Stoat.
const client = new Client({
  baseURL: process.env.STOAT_API_URL || 'https://stoat.chat/api'
});

// Registra a referência do cliente no serviço de integração
stoatService.setClient(client);

// 2. Carregamento dinâmico dos Comandos (Command Handler)
// O Stoat não possui Slash Commands, então os comandos são de texto com prefixo.
client.commands = new Map();

const commandsPath = path.join(import.meta.dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = await import(pathToFileURL(path.join(commandsPath, file)).href);
    if (command.name && command.execute) {
      client.commands.set(command.name.toLowerCase(), command);
      const prefix = process.env.COMMAND_PREFIX || '!';
      console.log(`[Command Handler] Comando carregado: ${prefix}${command.name}`);
    } else {
      console.warn(`[Command Handler] O arquivo ${file} não exporta "name" e "execute".`);
    }
  }
}

// 3. Carregamento dinâmico dos Eventos (Event Handler)
// O cliente é injetado como último argumento de todo handler.
const eventsPath = path.join(import.meta.dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const event = await import(pathToFileURL(path.join(eventsPath, file)).href);
    if (!event.name || !event.execute) {
      console.warn(`[Event Handler] O arquivo ${file} não exporta "name" e "execute".`);
      continue;
    }

    const handler = (...args) => {
      Promise.resolve(event.execute(...args, client)).catch(err => {
        console.error(`[Event Handler] Erro no evento "${event.name}":`, err);
      });
    };

    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
    console.log(`[Event Handler] Evento registrado: ${event.name}`);
  }
}

// 4. Eventos de ciclo de vida da conexão com o Stoat
client.on('connecting', () => console.log('[Stoat] Conectando ao WebSocket de eventos...'));
client.on('disconnected', () => {
  stoatService.setReady(false);
  console.warn('[Stoat] Conexão perdida. O stoat.js tentará reconectar automaticamente.');
});
client.on('error', (error) => console.error('[Stoat] Erro no cliente:', error?.message || error));

// 5. Inicialização do Servidor Web (Dashboard Express)
const PORT = process.env.PORT || 3000;
const app = createWebServer();

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Dashboard Web rodando em: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

// 6. Login do Bot no Stoat (se o Token estiver configurado)
if (process.env.STOAT_TOKEN && process.env.STOAT_TOKEN !== 'seu_token_aqui') {
  client.loginBot(process.env.STOAT_TOKEN).catch(err => {
    console.error('❌ Erro ao conectar o bot no Stoat:', err.message);
  });
} else {
  console.warn('⚠️ STOAT_TOKEN não foi configurado no arquivo .env. O servidor web continuará funcionando para testes de interface.');
}
