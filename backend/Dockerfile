# Multi-stage build for NestJS application
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage — zero apk calls, uses only what node:20-alpine already has
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /app/uploads && \
    chown -R nestjs:nodejs /app

EXPOSE 3000

# Entrypoint runs as root to fix volume ownership, then drops to nestjs via busybox su.
# Signal handling (PID 1 reaping) is provided by docker-compose init:true (tini).
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
