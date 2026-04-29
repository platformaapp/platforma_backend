#!/bin/sh
set -e
chown -R nestjs:nodejs /app/uploads 2>/dev/null || true
# Drop privileges via busybox su (available in node:20-alpine without apk).
# Signal reaping is handled by tini via docker-compose init:true.
exec su -s /bin/sh nestjs -c "exec $*"
