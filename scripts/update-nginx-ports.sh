#!/bin/bash
# Helper script to update Nginx ports after Certbot modifies the config
# Usage: ./scripts/update-nginx-ports.sh

set -e

# Get actual ports from docker-compose
COMPOSE_FILE="/root/searchv2/docker-compose.production.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: docker-compose.production.yml not found"
    exit 1
fi

# Extract ports from docker-compose file
SEARCH_API_PORT=$(grep -A 5 "search-api:" "$COMPOSE_FILE" | grep "127.0.0.1:" | head -1 | sed 's/.*127.0.0.1:\([0-9]*\):.*/\1/')
FRONTEND_PORT=$(grep -A 5 "search-frontend:" "$COMPOSE_FILE" | grep "127.0.0.1:" | head -1 | sed 's/.*127.0.0.1:\([0-9]*\):.*/\1/')

if [ -z "$SEARCH_API_PORT" ] || [ -z "$FRONTEND_PORT" ]; then
    echo "Error: Could not extract ports from docker-compose file"
    echo "SEARCH_API_PORT: $SEARCH_API_PORT"
    echo "FRONTEND_PORT: $FRONTEND_PORT"
    exit 1
fi

NGINX_CONFIG="/etc/nginx/sites-enabled/search.mangwale.ai"

if [ ! -f "$NGINX_CONFIG" ]; then
    echo "Error: Nginx config not found at $NGINX_CONFIG"
    exit 1
fi

echo "Updating Nginx configuration with actual ports:"
echo "  Search API: $SEARCH_API_PORT"
echo "  Frontend: $FRONTEND_PORT"

# Update API port (handle both localhost and 127.0.0.1)
sudo sed -i "s|proxy_pass http://127.0.0.1:3100;|proxy_pass http://127.0.0.1:$SEARCH_API_PORT;|g" "$NGINX_CONFIG"
sudo sed -i "s|proxy_pass http://localhost:3100;|proxy_pass http://localhost:$SEARCH_API_PORT;|g" "$NGINX_CONFIG"

# Update Frontend port (handle both localhost and 127.0.0.1)
sudo sed -i "s|proxy_pass http://127.0.0.1:6000;|proxy_pass http://127.0.0.1:$FRONTEND_PORT;|g" "$NGINX_CONFIG"
sudo sed -i "s|proxy_pass http://localhost:6000;|proxy_pass http://localhost:$FRONTEND_PORT;|g" "$NGINX_CONFIG"

# Test and reload
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✓ Nginx configuration updated and reloaded successfully"
else
    echo "✗ Nginx configuration test failed"
    exit 1
fi
