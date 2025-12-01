FROM node:16

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 5001

ENV NODE_ENV=production
ENV JWT_SECRET=my-super-secret-jwt-key-12345
ENV SESSION_SECRET=my-session-secret-key

CMD ["node", "server.js"]
