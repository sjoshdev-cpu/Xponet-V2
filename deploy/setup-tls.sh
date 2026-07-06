#!/usr/bin/env bash
# deploy/setup-tls.sh
# Run once on the VM after pointing your DNS A record at the server IP.
# Tested on Ubuntu 22.04 / 24.04 with Nginx already installed.
#
# Usage:
#   chmod +x deploy/setup-tls.sh
#   sudo ./deploy/setup-tls.sh yourdomain.com

set -euo pipefail

DOMAIN="${1:-yourdomain.com}"
EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"     # set CERTBOT_EMAIL env var to override
WEBROOT="/var/www/certbot"

echo "==> Installing Certbot (snap)…"
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot || true

echo "==> Creating ACME webroot…"
mkdir -p "$WEBROOT"

echo "==> Obtaining Let's Encrypt certificate for ${DOMAIN}…"
certbot certonly \
  --webroot \
  --webroot-path "$WEBROOT" \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "www.${DOMAIN}"

echo "==> Reloading Nginx…"
nginx -t && systemctl reload nginx

echo "==> Installing auto-renewal cron (runs twice daily, Certbot only renews when <30 days remain)…"
CRON_JOB="0 3,15 * * * root certbot renew --quiet --deploy-hook 'systemctl reload nginx'"
CRON_FILE="/etc/cron.d/certbot-renew"
echo "$CRON_JOB" > "$CRON_FILE"
chmod 644 "$CRON_FILE"

echo ""
echo "✓ TLS certificate obtained for ${DOMAIN}"
echo "✓ Auto-renewal cron written to ${CRON_FILE}"
echo ""
echo "Next steps:"
echo "  1. Copy deploy/nginx.conf to /etc/nginx/sites-available/${DOMAIN}"
echo "  2. sed -i 's/yourdomain.com/${DOMAIN}/g' /etc/nginx/sites-available/${DOMAIN}"
echo "  3. ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/"
echo "  4. nginx -t && systemctl reload nginx"
