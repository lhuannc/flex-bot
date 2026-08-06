# Guia de Implantação e Hospedagem (Deployment Guide) — FlexBot

Este documento explica por que o Netlify não é adequado para rodar Bots de Discord e apresenta o passo a passo para hospedar o **FlexBot** gratuitamente em plataformas próprias para servidores 24/7 como **Render.com** ou **Railway.app**.

---

## ⚠️ 1. Por que o Netlify NÃO roda o FlexBot?

- **Netlify é para Sites Estáticos / Serverless**: O Netlify foi projetado para páginas estáticas (HTML/React) e Serverless Functions (funções que duram apenas alguns segundos).
- **O Bot do Discord exige Conexão 24/7**: Um bot de Discord precisa manter um processo **Node.js rodando continuamente** conectado ao servidor do Discord (WebSocket/Gateway). No Netlify, o bot ficaria offline em poucos segundos.
- **Persistência de Dados**: O sistema de arquivos do Netlify é somente leitura, impedindo o salvamento das matrículas e regras no diretório `./data/`.

---

## 🚀 2. Onde hospedar o FlexBot 24/7 Gratuitamente?

Recomendamos as plataformas **Render.com** ou **Railway.app**, que possuem suporte nativo a **Containers Docker e servidores Node.js 24/7**.

---

### Option A: Hospedagem no Render.com (Recomendado - Gratuito)

1. Crie uma conta gratuita em [Render.com](https://render.com).
2. Conecte sua conta do GitHub e clique em **New +** -> **Web Service**.
3. Selecione o repositório **`flex-bot`**.
4. Configure as opções:
   - **Environment**: `Docker` (ele lerá o `Dockerfile` automaticamente).
   - **Region**: Oregon (US West) ou Frankfurt.
   - **Plan**: `Free`.
5. Em **Environment Variables** (Variáveis de Ambiente), adicione:
   - `DISCORD_TOKEN`: *(Seu token do bot)*
   - `CLIENT_ID`: `1534658355228967042`
   - `PORT`: `3000`
6. Clique em **Create Web Service**.

> ✨ O Render compilará a imagem Docker e manterá o bot do Discord e a Dashboard Web rodando 24 horas por dia!

---

### Option B: Hospedagem no Railway.app

1. Acesse [Railway.app](https://railway.app) e crie um projeto importando seu repositório do GitHub.
2. O Railway detectará o `docker-compose.yml` ou `Dockerfile` automaticamente.
3. Adicione as variáveis de ambiente (`DISCORD_TOKEN` e `CLIENT_ID`).
4. O bot estará online em menos de 2 minutos.
