# Guia de Implantação e Hospedagem (Deployment Guide) — FlexBot

Este documento explica por que plataformas estáticas como **GitHub Pages** e **Netlify** não conseguem rodar Bots de Discord e apresenta as opções de hospedagem 24/7 gratuitas no **Render.com** ou **Railway.app**.

---

## ❌ 1. Posso usar GitHub Pages ou Netlify? (NÃO)

### 🔴 GitHub Pages
- **Servidor Estático**: O GitHub Pages apenas entrega arquivos estáticos (HTML/CSS/JS) para o navegador do cliente.
- **Sem Node.js**: O GitHub Pages **não executa código Node.js** e não consegue manter o processo do FlexBot conectado ao Discord.
- **Resultado**: O bot fica **totalmente offline** e a Dashboard Web não consegue salvar dados.

### 🔴 Netlify / Vercel (Hospedagem Serverless)
- **Funções de Curta Duração**: O Netlify e o Vercel encerram qualquer execução após 10 a 26 segundos.
- **Resultado**: O bot desconecta do Discord em poucos segundos após ligar.

---

## 🟢 2. Onde hospedar o FlexBot 24 horas por dia (Gratuitamente)?

Para que o bot do Discord fique **online 24/7** e a Dashboard Web funcione, você precisa de uma plataforma que suporte **servidores Node.js ou Containers Docker contínuos**.

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

> ✨ O Render compilará a imagem Docker e manterá o bot do Discord e a Dashboard Web rodando 24 horas por dia gratuitamente!

---

### Option B: Hospedagem no Railway.app

1. Acesse [Railway.app](https://railway.app) e crie um projeto importando seu repositório do GitHub.
2. O Railway detectará o `docker-compose.yml` ou `Dockerfile` automaticamente.
3. Adicione as variáveis de ambiente (`DISCORD_TOKEN` e `CLIENT_ID`).
4. O bot estará online em menos de 2 minutos.
