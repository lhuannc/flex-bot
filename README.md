# 🤖 FlexBot — Bot de Validação para Stoat com Painel Web

O **FlexBot** é um bot modular em Node.js (utilizando **stoat.js v7**) desenvolvido para validação de matrículas corporativas/acadêmicas e concessão automática de cargos (roles) no **[Stoat](https://stoat.chat)** — a plataforma de chat open-source (antiga Revolt).

Acompanha um **Dashboard Web** completo em `http://localhost:3000` para gestão da base de matrículas, regras de canais e do motor de URA.

---

## 📚 Índice

- [Requisitos](#-requisitos)
- [Passo a Passo: Criar e Configurar o Bot no Stoat](#-passo-a-passo-criar-e-configurar-o-bot-no-stoat)
- [Obtendo IDs no Stoat](#-obtendo-ids-no-stoat)
- [Configuração do `.env`](#-configuração-do-env)
- [Como Rodar](#-como-rodar)
- [Comandos Disponíveis](#-comandos-disponíveis)
- [Funcionalidades](#-funcionalidades)
- [Migrando de uma instalação Discord](#-migrando-de-uma-instalação-discord)

---

## ✅ Requisitos

| Item | Versão / Observação |
|---|---|
| **Node.js** | **>= 22.15.0** — exigido pelo `stoat.js` |
| **Modo de módulos** | **ES Modules** (`"type": "module"` já configurado) |
| **Docker** (opcional) | Imagem base `node:22-alpine` |
| **Conta no Stoat** | [stoat.chat](https://stoat.chat) ou uma instância self-hosted |

> ⚠️ O `stoat.js` **não funciona em CommonJS nem em Node.js 20**. Todo o projeto foi convertido para ESM (`import`/`export`).

---

## 🛠️ Passo a Passo: Criar e Configurar o Bot no Stoat

O Stoat **não possui um "Developer Portal" separado** como o Discord. A criação de bots é feita dentro do próprio aplicativo:

1. Acesse o app do Stoat: [https://stoat.chat/app](https://stoat.chat/app) (ou a URL da sua instância self-hosted) e faça login.
2. Abra **Configurações** (Settings) → **Meus Bots** (My Bots).
3. Clique em **Criar um Bot** (Create a Bot), defina o nome (ex: `FlexBot`) e confirme.
4. Clique em **Editar** (Edit) no bot recém-criado:
   - Clique em **Copiar** (Copy) ao lado do **Token**.
     > ⚠️ **ATENÇÃO:** Cole este token no campo `STOAT_TOKEN` do seu arquivo `.env`. Nunca compartilhe nem versione este token. Se ele vazar, use **Regenerar** (Regenerate) imediatamente.
   - *(Opcional)* Ative **Bot Público** (Public Bot) se outras pessoas precisarem convidá-lo.
   - *(Opcional)* Faça upload do avatar oficial.
5. Clique em **Copiar Link de Convite** (Copy Invite Link) e abra a URL no navegador para adicionar o FlexBot ao seu servidor.

### ⚠️ Ajuste Obrigatório de Permissões e Hierarquia de Cargos

Para que a atribuição automática de cargos funcione, após adicionar o bot ao servidor:

1. Abra **Configurações do Servidor** → **Cargos** (Roles).
2. Crie (ou selecione) um cargo para o FlexBot e conceda a permissão **Gerenciar Cargos / Atribuir Cargos** (`AssignRoles`).
3. **A posição (rank) do cargo do FlexBot deve estar ACIMA de todos os cargos que ele precisará atribuir.**
   - No Stoat, cada cargo possui um `rank` numérico: **quanto menor o número, maior a prioridade**.
   - Se o cargo do FlexBot estiver abaixo do cargo alvo, a API retornará erro de permissão e o cargo não será aplicado.
4. Garanta também as permissões **Enviar Mensagens**, **Gerenciar Mensagens** (necessária para a auto-deleção) e **Enviar Embeds** (usada pelo comando `status`) nos canais de validação.

---

## 🔎 Obtendo IDs no Stoat

Os IDs do Stoat são **ULIDs** (ex: `01HB2C3D4E5F6G7H8J9K0LMNPQ`), e não números longos como no Discord.

1. No app do Stoat, abra **Configurações** → **Aparência** e ative o **Modo Desenvolvedor** (Developer Mode).
2. Clique com o botão direito sobre um **servidor**, **canal**, **cargo** ou **usuário** e escolha **Copiar ID**.

> 💡 Na prática você raramente precisará copiar IDs manualmente: o Dashboard Web lista servidores, cargos e canais em menus suspensos, preenchidos automaticamente pela API do Stoat.

---

## ⚙️ Configuração do `.env`

Copie o `.env.example` para `.env` e preencha:

```env
# Token do bot (Configurações -> Meus Bots -> Editar -> Copiar Token)
STOAT_TOKEN=cole_seu_token_aqui

# API da instância do Stoat (oficial ou self-hosted)
STOAT_API_URL=https://stoat.chat/api

# Prefixo dos comandos de texto (o Stoat não possui Slash Commands)
COMMAND_PREFIX=!

# Porta do Dashboard Web
PORT=3000

# (OPCIONAL) Fallbacks — normalmente definidos pelo Dashboard em cada regra
SERVER_ID=
ROLE_ID=
ALLOWED_CHANNEL_ID=
```

### Usando uma instância self-hosted

Basta apontar `STOAT_API_URL` para a API da sua instância — por exemplo `https://chat.suaempresa.gov.br/api`. O `stoat.js` descobre automaticamente o endereço do WebSocket de eventos a partir dessa configuração.

---

## 🚀 Como Rodar

### Via Docker (recomendado)

```bash
cd c:/projetos/flex-bot

# Subir a aplicação
docker compose up -d --build

# Acompanhar os logs em tempo real
docker logs flex-bot-app -f
```

### Via Node.js local (requer Node >= 22.15.0)

```bash
npm install
npm start
```

- **Dashboard Web**: `http://localhost:3000`

> ℹ️ **Não existe passo de "deploy de comandos".** O antigo `deploy-commands.js` era exclusivo dos Slash Commands do Discord e foi removido — o Stoat não possui API de *interactions*.

---

## 💬 Comandos Disponíveis

Como o Stoat **não possui Slash Commands**, os comandos são de texto e usam o `COMMAND_PREFIX` (padrão `!`):

| Comando | Descrição |
|---|---|
| `!matricula <numero>` | Valida a matrícula na base oficial e atribui o cargo configurado. Em canais públicos, a mensagem do usuário é apagada e a resposta é auto-deletada conforme a regra. |
| `!status` | Exibe status do bot, total de matrículas, regras ativas e a URL do Dashboard. |

Além dos comandos, o bot também reage a:

- **Matrícula digitada diretamente** em um canal autorizado por uma regra ativa.
- **Mensagens diretas (DM)**, atendidas pelo motor de URA multi-nível.

---

## ✨ Funcionalidades

- **Base Oficial de Matrículas**: cadastro individual, importação em massa (colar milhares de números) e exclusão em lote com seleção múltipla.
- **Regras de Canais de Texto**: vincula um canal do Stoat a um cargo, com mensagens de sucesso/erro personalizáveis e auto-deleção programada.
- **URA Multi-Nível em DM**: menus e submenus navegáveis por número, com **Consequências Combináveis (E/OU)**: enviar mensagem, atribuir cargo, solicitar matrícula e abrir submenu.
- **Gatilhos de DM**: boas-vindas automáticas na entrada no servidor, saudação por palavra-chave e disparo em massa para membros atuais.
- **Envio de DMs**: dispare mensagens privadas para qualquer usuário pelo ID do Stoat.

---

## 🔄 Migrando de uma instalação Discord

Se você já rodava o FlexBot no Discord, atente-se aos pontos abaixo:

| Antes (Discord) | Agora (Stoat) |
|---|---|
| `DISCORD_TOKEN` | `STOAT_TOKEN` |
| `CLIENT_ID` | *(não existe — o bot é identificado pelo token)* |
| `GUILD_ID` | `SERVER_ID` |
| Slash Commands `/matricula` | Comando de texto `!matricula` |
| `deploy-commands.js` | *(removido)* |
| `guildId` nas regras | `serverId` (migrado automaticamente na leitura) |

⚠️ **Ação necessária:** IDs do Discord (números longos, ex: `1532769863808843959`) **não são válidos no Stoat**, que usa ULIDs. Portanto:

1. Abra o Dashboard e **reconfigure cada regra**, selecionando novamente servidor, cargo e canal nos menus suspensos.
2. Revise os textos das mensagens em `data/rules.json` e `data/dm_rules.json` — links no formato `https://discord.com/channels/...` precisam ser trocados pelos links equivalentes do Stoat.
3. A base `data/matriculas.json` é agnóstica de plataforma e **continua válida sem alterações**.

---

## 📂 Documentação Complementar

| Documento | Conteúdo |
|---|---|
| [docs/project_context.md](docs/project_context.md) | Contexto master do projeto |
| [docs/stoat_installation_guide.md](docs/stoat_installation_guide.md) | Instalação e convite do bot no Stoat |
| [docs/bot_architecture_and_multiplatform.md](docs/bot_architecture_and_multiplatform.md) | Arquitetura desacoplada e integração multi-plataforma |
| [docs/data_storage_architecture.md](docs/data_storage_architecture.md) | Persistência em JSON e Docker |
| [docs/deployment_guide.md](docs/deployment_guide.md) | Hospedagem gratuita (Render / Railway) |
| [docs/system_limitations.md](docs/system_limitations.md) | Rate limits do Stoat e concorrência |
| [docs/access_flows.md](docs/access_flows.md) | Fluxos de permissão de acesso: canais de texto e voz (COLABORADOR + VOZ) |
