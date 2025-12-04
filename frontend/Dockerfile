FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_OPTIONS=--openssl-legacy-provider

RUN npm run build
RUN npm install -g serve

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
