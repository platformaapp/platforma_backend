#!/bin/sh
set -e
# Fix ownership of the uploads volume on every container start.
# The volume may have been created as root:root on first run; chown it before
# dropping privileges so the nestjs process can write uploaded files.
chown -R nestjs:nodejs /app/uploads 2>/dev/null || true
exec su-exec nestjs dumb-init -- "$@"
