FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV REACT_APP_API_KEY=frontend-api-key-123456

RUN npm run build

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
