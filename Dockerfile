# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY src/ ./src/
COPY scripts/ ./scripts/
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
