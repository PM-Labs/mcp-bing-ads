FROM node:22-alpine
WORKDIR /app

# Install dependencies (prod only)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Copy OAuth proxy server
COPY server.js ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
