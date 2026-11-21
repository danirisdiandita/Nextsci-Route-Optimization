FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
EXPOSE 8081
CMD ["npx", "expo", "start", "--lan"]
