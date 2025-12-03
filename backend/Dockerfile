FROM node:24-alpine

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 5001

ENV NODE_ENV=production
ENV JWT_SECRET=my-super-secret-jwt-key-12345
ENV SESSION_SECRET=my-session-secret-key

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 \
  && chown -R nodejs:nodejs /app

USER nodejs

CMD ["node", "server.js"]
