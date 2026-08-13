# Guia de Implantação e Hospedagem (Deployment Guide) — FlexBot

Este documento explica como rodar o **FlexBot 100% GRATUITO** no **Render.com** ou **Railway.app**.

---

## ⚠️ 0. Pré-requisito Crítico: Node.js 22

O `stoat.js` exige **Node.js >= 22.15.0 rodando em modo ES Module**. O [`Dockerfile`](file:///c:/projetos/flex-bot/Dockerfile) já usa a imagem `node:22-alpine`, então tanto o Render quanto o Railway atenderão ao requisito automaticamente ao detectar o Docker.

> 🚫 Não configure o serviço como "Node" nativo com runtime 20 — a aplicação não inicializará.

---

## 🟢 1. Como Usar a Versão 100% GRATUITA no Render.com

Para utilizar o Render **sem pagar absolutamente nada** (sem comprar discos pagos):

### 🛠️ O que ajustamos no código para o Plano Gratuito:
1. O [`Dockerfile`](file:///c:/projetos/flex-bot/Dockerfile) **cria automaticamente a pasta `/app/data`** com permissões totais de leitura e escrita (`chmod 777`) durante a compilação da imagem Docker.
2. A pasta `data/` foi versionada no Git com os arquivos padrões (`matriculas.json`, `rules.json`, `dm_rules.json`).
3. Todos os arquivos de serviço foram protegidos contra exceções de escrita no disco efêmero.

> ⚠️ **Atenção ao disco efêmero:** no plano gratuito, o conteúdo de `/app/data` é perdido a cada novo deploy. Faça o cadastro das matrículas via Dashboard após cada publicação, ou versione a base atualizada no repositório.

---

### 📋 Passo a Passo para Criar o Serviço Gratuito no Render.com:

1. Acesse o painel do [Render.com](https://dashboard.render.com).
2. Clique em **New +** ➔ selecione **Web Service**.
3. Conecte seu repositório do **`flex-bot`** do GitHub.
4. Preencha as opções:
   - **Name**: `flex-bot`
   - **Environment**: Selecione `Docker` *(ele lerá o Dockerfile com Node 22 e a correção do /app/data)*.
   - **Region**: Oregon (US West) ou Frankfurt.
   - **Instance Type / Plan**: **`Free` ($0/month)**.
5. Em **Environment Variables** (Variáveis de Ambiente), adicione:
   - `STOAT_TOKEN` = *(Seu token do bot, obtido em Configurações → Meus Bots)*
   - `STOAT_API_URL` = `https://stoat.chat/api` *(ou a URL da sua instância self-hosted)*
   - `COMMAND_PREFIX` = `!`
   - `PORT` = `3000`
6. **NÃO precisa adicionar nenhum "Disk" pago.**
7. Clique em **Create Web Service**.

> 🎉 **Pronto!** O Render compilará a imagem Docker, criará as permissões na pasta `/app/data` e o **FlexBot ficará online 24/7 de forma 100% gratuita**!

---

## 🟢 2. Alternativa: Hospedagem 100% Gratuita no Railway.app

1. Acesse [Railway.app](https://railway.app) e crie um projeto importando seu repositório do GitHub.
2. O Railway detectará o `Dockerfile` automaticamente (Node 22 Alpine).
3. Adicione as variáveis de ambiente (`STOAT_TOKEN`, `STOAT_API_URL`, `COMMAND_PREFIX` e `PORT`).
4. Clique em **Deploy**.

---

## 🔍 3. Validando o Deploy

Nos logs do serviço, procure por:

```
[Command Handler] Comando carregado: !matricula
[Command Handler] Comando carregado: !status
[Event Handler] Evento registrado: messageCreate
[Event Handler] Evento registrado: ready
[Event Handler] Evento registrado: serverMemberJoin
🚀 Dashboard Web rodando em: http://localhost:3000
[Event Ready] Bot conectado com sucesso no Stoat como: FlexBot
```

Se aparecer `⚠️ STOAT_TOKEN não foi configurado`, revise as variáveis de ambiente do serviço.

> ℹ️ **Não existe etapa de "deploy de comandos".** O antigo `deploy-commands.js` registrava Slash Commands na API do Discord; o Stoat não possui esse conceito, e o arquivo foi removido do projeto.

---

## 🏠 4. Rodando com uma Instância Self-Hosted do Stoat

Se a Prefeitura hospedar sua própria instância do Stoat, basta apontar a variável:

```env
STOAT_API_URL=https://chat.suaempresa.gov.br/api
```

O `stoat.js` consulta essa URL na inicialização e descobre automaticamente o endereço do WebSocket de eventos da instância — nenhuma outra alteração é necessária no código.
