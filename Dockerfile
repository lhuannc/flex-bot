FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

# Criar pasta /app/data com permissão total de leitura/escrita para o Plano Gratuito do Render
RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 3000

CMD ["node", "index.js"]
