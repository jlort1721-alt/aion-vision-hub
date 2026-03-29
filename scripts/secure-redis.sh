#!/bin/bash
# Secure Redis with password authentication
# Run this script on the VPS as root or with sudo privileges.
#
# DEPLOYMENT NOTE (2026-03-28):
#   SSH into the VPS and run:  sudo bash /var/www/scripts/secure-redis.sh
#   After running, verify with:  redis-cli -a 'A10n_R3d1s_2026!' ping
#   Expected output: PONG
set -euo pipefail

REDIS_PASS="A10n_R3d1s_2026!"

echo ">>> Ensuring Redis only listens on localhost..."
sudo sed -i 's/^# *bind 127\.0\.0\.1/bind 127.0.0.1/' /etc/redis/redis.conf
if ! grep -q '^bind 127.0.0.1' /etc/redis/redis.conf; then
  echo "bind 127.0.0.1 ::1" | sudo tee -a /etc/redis/redis.conf
fi

echo ">>> Configuring Redis password..."
echo "requirepass $REDIS_PASS" | sudo tee -a /etc/redis/redis.conf
sudo systemctl restart redis-server

echo ">>> Testing Redis connection with password..."
redis-cli -a "$REDIS_PASS" ping

echo ">>> Updating .env files with Redis password..."
for ENV in /var/www/aionseg/backend/apps/backend-api/.env /var/www/aion/backend/apps/backend-api/.env; do
  if [ -f "$ENV" ]; then
    sed -i "s|REDIS_URL=redis://localhost:6379|REDIS_URL=redis://:$REDIS_PASS@localhost:6379|" "$ENV"
    echo "    Updated $ENV"
  else
    echo "    WARNING: $ENV not found, skipping"
  fi
done

echo ">>> Restarting API services..."
pm2 restart aionseg-api aion-api

echo ">>> Redis secured with password"
