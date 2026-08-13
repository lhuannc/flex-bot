# stoat.js exige Node.js >= 22.15.0 rodando em modo ES Module
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

# Criar pasta /app/data com permissão total de leitura/escrita para o Plano Gratuito do Render
RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 3000

CMD ["node", "index.js"]
