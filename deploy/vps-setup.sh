#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════
# AION VPS Initial Setup — Run ONCE on fresh Ubuntu VPS
# ═══════════════════════════════════════════════════════════

echo "→ Updating system..."
sudo apt update && sudo apt upgrade -y

echo "→ Installing dependencies..."
sudo apt install -y nginx certbot python3-certbot-nginx \
  redis-server git curl ufw

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2

echo "→ Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "→ Creating app directory..."
sudo mkdir -p /var/www/aion/{frontend,backend}
sudo chown -R ubuntu:ubuntu /var/www/aion

echo "→ Configuring Nginx..."
sudo cp /var/www/aion/deploy/nginx-aion.conf /etc/nginx/sites-available/aiosystem.co
sudo ln -sf /etc/nginx/sites-available/aiosystem.co /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "→ Setting up SSL with Let's Encrypt..."
sudo certbot --nginx -d aiosystem.co -d www.aiosystem.co --non-interactive --agree-tos --email jlort1721@gmail.com

echo "→ Configuring Redis..."
sudo systemctl enable redis-server
sudo systemctl start redis-server

echo "→ Setting up PM2 startup..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "→ Creating backup directory..."
sudo mkdir -p /backups/aion
sudo chown ubuntu:ubuntu /backups/aion

echo ""
echo "═══════════════════════════════════════════"
echo " ✓ VPS Setup Complete"
echo " Domain: aiosystem.co"
echo " Next: Run deploy.sh from your Mac"
echo "═══════════════════════════════════════════"
