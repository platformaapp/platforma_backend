# Multi-stage build for NestJS application
FROM node:20-alpine AS builder

# Install system tools in builder so production stage needs no apk calls
RUN apk add --no-cache dumb-init su-exec

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage — no apk needed, copy binaries from builder
FROM node:20-alpine AS production

# Copy dumb-init and su-exec from builder (avoids slow apk download in production layer)
COPY --from=builder /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=builder /sbin/su-exec /sbin/su-exec

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/uploads && \
    chown -R nestjs:nodejs /app

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
