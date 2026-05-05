#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SEED_SCRIPT="$SCRIPT_DIR/../src/seeds/seed-admin.js"

# Load .env from project root
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in $ENV_FILE"
  exit 1
fi

# Find the running backend container
CONTAINER_ID=$(docker compose --project-directory "$PROJECT_ROOT" -f "$PROJECT_ROOT/docker-compose.yml" ps -q backend 2>/dev/null | head -1)

if [ -z "$CONTAINER_ID" ]; then
  echo "Error: backend container is not running."
  echo "Start it first: cd $PROJECT_ROOT && docker compose up -d"
  exit 1
fi

echo "Copying seed script into container $CONTAINER_ID..."
docker cp "$SEED_SCRIPT" "$CONTAINER_ID":/tmp/seed-admin.js

echo "Running seed..."
docker exec \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_NAME="${ADMIN_NAME:-Администратор}" \
  -e DB_HOST="$DB_HOST" \
  -e DB_PORT="${DB_PORT:-5432}" \
  -e DB_USERNAME="$DB_USERNAME" \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e DB_NAME="$DB_NAME" \
  "$CONTAINER_ID" \
  node /tmp/seed-admin.js
