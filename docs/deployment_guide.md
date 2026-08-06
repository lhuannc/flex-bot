# Guia de Implantação e Hospedagem (Deployment Guide) — FlexBot

Este documento explica como rodar o **FlexBot 100% GRATUITO** no **Render.com** ou **Railway.app**.

---

## 🟢 1. Como Usar a Versão 100% GRATUITA no Render.com

Para utilizar o Render **sem pagar absolutamente nada** (sem comprar discos pagos):

### 🛠️ O que ajustamos no código para o Plano Gratuito:
1. O [`Dockerfile`](file:///c:/projetos/flex-bot/Dockerfile) foi atualizado para **criar automaticamente a pasta `/app/data`** com permissões totais de leitura e escrita (`chmod 777`) durante a compilação da imagem Docker.
2. A pasta `data/` foi versionada no Git com os arquivos padrões (`matriculas.json`, `rules.json`, `dm_rules.json`).
3. Todos os arquivos de serviço foram protegidos contra exceções de escrita no disco efêmero.

---

### 📋 Passo a Passo para Criar o Serviço Gratuito no Render.com:

1. Acesse o painel do [Render.com](https://dashboard.render.com).
2. Clique em **New +** ➔ selecione **Web Service**.
3. Conecte seu repositório do **`flex-bot`** do GitHub.
4. Preencha as opções:
   - **Name**: `flex-bot`
   - **Environment**: Selecione `Docker` *(ele lerá o Dockerfile com a correção do /app/data)*.
   - **Region**: Oregon (US West) ou Frankfurt.
   - **Instance Type / Plan**: **`Free` ($0/month)**.
5. Em **Environment Variables** (Variáveis de Ambiente), adicione:
   - `DISCORD_TOKEN` = *(Seu token do bot)*
   - `CLIENT_ID` = `1534658355228967042`
   - `PORT` = `3000`
6. **NÃO precisa adicionar nenhum "Disk" pago.**
7. Clique em **Create Web Service**.

> 🎉 **Pronto!** O Render compilará a imagem Docker ajustada, criará as permissões na pasta `/app/data` e o **FlexBot ficará online 24/7 de forma 100% gratuita**!

---

## 🟢 2. Alternativa: Hospedagem 100% Gratuita no Railway.app

1. Acesse [Railway.app](https://railway.app) e crie um projeto importando seu repositório do GitHub.
2. O Railway detectará o `Dockerfile` automaticamente.
3. Adicione as variáveis de ambiente (`DISCORD_TOKEN` e `CLIENT_ID`).
4. Clique em **Deploy**.
