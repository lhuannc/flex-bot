# Arquitetura do FlexBot & Guia de Integração Multi-Plataforma (Slack, Telegram, Web Widgets)

Este documento detalha a arquitetura interna do **FlexBot**, como seus módulos de validação de matrícula e URA funcionam e como ele pode ser reutilizado/adaptado para outras ferramentas de comunicação (como **Slack**, **Telegram**, **WhatsApp**, ou widgets de atendimento web).

---

## 🏛️ 1. Visão Geral da Arquitetura (Decoupled Engine)

O FlexBot foi desenvolvido com uma **Arquitetura Desacoplada** em camadas independentes. A lógica de negócios, validação de matrículas e árvore de URA **não dependem do Stoat**. O Stoat atua apenas como uma *interface de transporte*.

```mermaid
graph TD
    subgraph "Camada de Interfaces de Comunicação (Plataformas)"
        Stoat["Stoat Bot (stoat.js)<br/>(Eventos & WebSocket)"]
        Slack["Slack Bot Adaptador<br/>(Slack Bolt SDK)"]
        Telegram["Telegram / WhatsApp Adaptador"]
        WebChat["Widget Web / Chat API"]
    end

    subgraph "Motor Central de Negócios (Core Engine - Agnóstico)"
        DatabaseService["Base de Matrículas<br/>(databaseService.js)"]
        RuleService["Motor de Regras<br/>(ruleService.js)"]
        IVRService["Motor de URA Multi-Nível<br/>(ivrService.js)"]
        DMTriggerService["Gatilhos de Disparo<br/>(dmTriggerService.js)"]
    end

    subgraph "Camada de Gestão & Persistência"
        ExpressAPI["Servidor REST API<br/>(web/server.js & Dashboard)"]
        JSONStorage["Arquivos JSON de Persistência<br/>(./data/matriculas.json, rules.json)"]
    end

    Stoat --> IVRService
    Slack --> IVRService
    Telegram --> IVRService
    WebChat --> IVRService

    IVRService --> DatabaseService
    RuleService --> DatabaseService

    ExpressAPI --> JSONStorage
    DatabaseService --> JSONStorage
    RuleService --> JSONStorage
```

### Regra de ouro da arquitetura

> **Nenhum módulo além de `services/stoatService.js` importa o `stoat.js` diretamente.**
> Toda comunicação com a plataforma passa por esse serviço, o que mantém o motor de URA e as regras totalmente agnósticos e permite trocar de plataforma escrevendo apenas um novo adaptador.

---

## 🧩 2. Como Funciona Cada Módulo do Bot

### 1. Base Oficial de Matrículas (`services/databaseService.js`)
- **Função**: Armazena e valida códigos numéricos corporativos em tempo real.
- **Formato**: JSON persistente (`data/matriculas.json`) com buscas otimizadas em memória (`Set` / `Array.includes`).
- **Recursos**: Adição individual, importação em massa (CSV/texto), exclusão em lote e busca instantânea.

### 2. Motor de URA Multi-Nível (`services/ivrService.js` & `dmRuleService.js`)
- **Função**: Gerencia a árvore de menus interativos privados por sessão de usuário.
- **Controle de Estado**: Mantém em memória a etapa atual do atendimento de cada usuário (`ROOT`, `SUBMENU`, `AWAITING_MATRICULA`).
- **Consequências Combináveis (E/OU)**: Cada opção pode disparar:
  - 💬 **Enviar Mensagem**: Texto informativo ou link de canal.
  - 🏷️ **Conceder Cargo / Tag**: Atribuição de permissão corporativa.
  - 🎓 **Solicitar Matrícula**: Valida o código numérico na base oficial.
  - 🌳 **Abrir Submenu**: Navegação em níveis secundários de opções.

### 3. Motor de Regras e Canais (`services/ruleService.js`)
- **Função**: Filtra mensagens enviadas em canais públicos ou privados.
- **Recursos**:
  - Filtro por canal autorizado (ex: `#validação`).
  - Tempo de auto-deleção da resposta (`deleteDelaySeconds`).
  - Template de mensagens dinâmicas com substituição de tags (`{user}`, `{server}`, `{role}`).

### 4. Adaptador do Stoat (`services/stoatService.js`)
- **Função**: Única fronteira com a API do Stoat.
- **Responsabilidades**: listar servidores/cargos/canais, atribuir cargos (mesclando a lista existente, já que o Stoat substitui o array inteiro no `PATCH`), abrir DMs e realizar disparos em massa com intervalo entre envios.

### 5. Servidor REST API e Dashboard Web (`web/server.js`)
- **Função**: Expõe endpoints RESTful HTTP em Express para que qualquer painel web ou sistema externo liste, adicione e gerencie as regras e matrículas.
- **Endpoints de plataforma**: `/api/stoat/servers`, `/api/stoat/servers/:serverId/roles`, `/api/stoat/servers/:serverId/channels`.

---

## 🚀 3. Podemos usar o FlexBot em outras ferramentas (ex: Slack, Telegram, Web Chat)?

### **SIM, 100%!**

Como a lógica do bot está **desacoplada**, para migrar ou estender o FlexBot para outra ferramenta, **você só precisa criar um pequeno arquivo adaptador de plataforma** que escuta as mensagens da nova ferramenta e chama os mesmos módulos centrais (`ivrService.js` e `databaseService.js`).

> ℹ️ Todos os exemplos abaixo usam **sintaxe ESM (`import`)**, pois o projeto roda em modo ES Module (exigência do `stoat.js`).

---

### 📋 Exemplo Prático de Adaptação para Outras Plataformas:

#### A. Para um **Widget Web / Chat via Webhook**:
Widgets web normalmente enviam mensagens via webhook HTTP (JSON POST). Para integrá-lo:
```javascript
// Exemplo de rota em web/server.js para um widget de chat web
import * as ivrService from '../services/ivrService.js';

app.post('/api/webchat/message', async (req, res) => {
  const { userId, text } = req.body; // Mensagem recebida do widget

  // Executa exatamente o mesmo motor de URA e Matrículas!
  const reply = await ivrService.processGenericMessage(userId, text);

  res.json({ replyMessage: reply });
});
```

#### B. Para a plataforma **Slack**:
Basta instalar o pacote oficial `@slack/bolt` e conectar as mensagens recebidas:
```javascript
import pkg from '@slack/bolt';
const { App } = pkg;
import * as databaseService from './services/databaseService.js';

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

slackApp.message(async ({ message, say }) => {
  // Processa a validação usando o mesmo banco de matrículas!
  const isMatch = databaseService.validarMatricula(message.text);
  if (isMatch) {
    await say(`✅ Matrícula ${message.text} validada no Slack!`);
  }
});
```

#### C. Para **Telegram** (via Telegraf SDK) ou **WhatsApp**:
O mesmo princípio se aplica: recebe a mensagem do usuário do Telegram/WhatsApp, chama `databaseService.validarMatricula(texto)` ou o motor de URA e retorna a resposta.

---

## 🔁 4. O que muda ao trocar de plataforma?

Ao portar o FlexBot para outra ferramenta, apenas a **camada de transporte** precisa de tradução:

| Conceito no núcleo | Stoat | Slack | Telegram |
|---|---|---|---|
| Servidor / Workspace | `Server` | Workspace | Grupo / Canal |
| Canal | `Channel` (`TextChannel`) | Channel | Chat |
| Cargo / Permissão | `ServerRole` (via `member.edit({ roles })`) | User Group | *(sem equivalente direto)* |
| Conversa privada | `user.openDM()` | `im.open` | Chat privado |
| Comando | Texto com prefixo (`!matricula`) | Slash Command nativo | `/comando` nativo |

> ⚠️ Diferente do Discord, **o Stoat não possui Slash Commands nem API de *interactions***. Os comandos do FlexBot são de texto, interpretados no evento `messageCreate` com o prefixo definido em `COMMAND_PREFIX`.

---

## 💡 Resumo das Vantagens da Estrutura

1. **Reaproveitamento Total de Código**: Você não precisa reescrever a validação de matrículas nem as regras da URA ao mudar de chat.
2. **Base Única de Dados**: O arquivo `matriculas.json` e o Dashboard Web continuarão sendo a fonte da verdade para **todas as plataformas simultaneamente**.
3. **Escalabilidade**: Permite rodar o bot no Stoat, Slack e num widget web ao mesmo tempo compartilhando as mesmas regras corporativas!
