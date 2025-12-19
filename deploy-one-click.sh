#!/bin/bash

###############################################################################
# Mangwale Search - ONE-CLICK DEPLOYMENT SCRIPT
# This script fully automates deployment with zero manual intervention
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() { echo -e "\n${BLUE}========================================${NC}\n${BLUE}$1${NC}\n${BLUE}========================================${NC}\n"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

COMPOSE_FILE="docker-compose.yml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

###############################################################################
# Pre-flight Checks
###############################################################################
preflight_checks() {
    print_header "Pre-flight Checks"
    
    # Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker installed"
    
    # Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose not installed."
        exit 1
    fi
    print_success "Docker Compose installed"
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        print_error "Docker daemon not running. Please start Docker."
        exit 1
    fi
    print_success "Docker daemon running"
    
    # Disk space
    AVAILABLE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 10 ]; then
        print_warning "Low disk space: ${AVAILABLE_SPACE}GB. Recommended: 20GB+"
    else
        print_success "Disk space: ${AVAILABLE_SPACE}GB available"
    fi
    
    # Memory
    AVAILABLE_MEM=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo "8")
    if [ "$AVAILABLE_MEM" -lt 4 ]; then
        print_warning "Low memory: ${AVAILABLE_MEM}GB. Recommended: 8GB+"
    else
        print_success "Memory: ${AVAILABLE_MEM}GB available"
    fi
}

###############################################################################
# Environment Setup
###############################################################################
setup_environment() {
    print_header "Setting Up Environment"
    
    if [ ! -f ".env" ]; then
        print_info "Creating .env from template..."
        cp .env.example .env
        print_success "Created .env file"
    else
        print_info ".env file already exists"
    fi
    
    # Source environment
    set -a
    source .env
    set +a
    
    # Set defaults if not specified
    DOMAIN=${DOMAIN:-search.test.mangwale.ai}
    HTTP_PORT=${HTTP_PORT:-80}
    HTTPS_PORT=${HTTPS_PORT:-443}
    
    print_success "Environment configured"
    print_info "Domain: $DOMAIN"
}

###############################################################################
# System Configuration
###############################################################################
configure_system() {
    print_header "Configuring System"
    
    # vm.max_map_count for OpenSearch
    CURRENT_MAP_COUNT=$(sysctl -n vm.max_map_count 2>/dev/null || echo "0")
    if [ "$CURRENT_MAP_COUNT" -lt 262144 ]; then
        print_info "Setting vm.max_map_count for OpenSearch..."
        if [ "$EUID" -eq 0 ]; then
            sysctl -w vm.max_map_count=262144 2>/dev/null || true
            echo "vm.max_map_count=262144" >> /etc/sysctl.conf 2>/dev/null || true
        else
            sudo sysctl -w vm.max_map_count=262144 2>/dev/null || print_warning "Could not set vm.max_map_count (may need sudo)"
        fi
    fi
    print_success "System configured"
}

###############################################################################
# Generate Traefik Config
###############################################################################
generate_traefik_config() {
    print_header "Generating Traefik Configuration"
    
    DOMAIN=${DOMAIN:-search.test.mangwale.ai}
    
    mkdir -p traefik-config/dynamic
    
    cat > traefik-config/dynamic/search-mangwale.yml <<EOF
http:
  routers:
    # HTTP to HTTPS Redirect
    search-redirect:
      rule: "Host(\`$DOMAIN\`)"
      entryPoints:
        - web
      service: noop@internal
      middlewares:
        - https-redirect

    # API Router (HTTPS)
    search-api:
      rule: "Host(\`$DOMAIN\`) && (PathPrefix(\`/search\`) || PathPrefix(\`/analytics\`) || PathPrefix(\`/health\`) || PathPrefix(\`/docs\`) || PathPrefix(\`/api-docs\`) || PathPrefix(\`/v2\`))"
      service: search-api-service
      entryPoints:
        - websecure
      priority: 10
      tls:
        certResolver: letsencrypt

    # Legacy Suggest Fix
    search-suggest-fix:
      rule: "Host(\`$DOMAIN\`) && PathPrefix(\`/search/suggest\`)"
      service: search-api-service
      entryPoints:
        - websecure
      priority: 20
      middlewares:
        - suggest-rewrite
      tls:
        certResolver: letsencrypt

    # Frontend Router (HTTPS)
    search-frontend:
      rule: "Host(\`$DOMAIN\`)"
      service: search-frontend-service
      entryPoints:
        - websecure
      priority: 1
      tls:
        certResolver: letsencrypt

  middlewares:
    https-redirect:
      redirectScheme:
        scheme: https
        permanent: true
    
    suggest-rewrite:
      replacePathRegex:
        regex: "^/search/suggest(.*)"
        replacement: "/v2/search/suggest\$1"

  services:
    search-api-service:
      loadBalancer:
        servers:
          - url: "http://search-api:3100"

    search-frontend-service:
      loadBalancer:
        servers:
          - url: "http://search-frontend:80"
EOF

    print_success "Traefik config generated for $DOMAIN"
}

###############################################################################
# Build and Deploy
###############################################################################
build_and_deploy() {
    print_header "Building and Deploying Services"
    
    print_info "Pulling base images..."
    docker-compose -f $COMPOSE_FILE pull 2>/dev/null || docker compose -f $COMPOSE_FILE pull
    
    print_info "Building custom images..."
    docker-compose -f $COMPOSE_FILE build --no-cache 2>/dev/null || docker compose -f $COMPOSE_FILE build --no-cache
    
    print_info "Starting all services..."
    docker-compose -f $COMPOSE_FILE up -d 2>/dev/null || docker compose -f $COMPOSE_FILE up -d
    
    print_success "Services started"
}

###############################################################################
# Wait for Health
###############################################################################
wait_for_services() {
    print_header "Waiting for Services to be Healthy"
    
    local MAX_WAIT=300
    local ELAPSED=0
    local INTERVAL=10
    
    print_info "This may take 3-5 minutes on first run..."
    
    while [ $ELAPSED -lt $MAX_WAIT ]; do
        # Check critical services
        OPENSEARCH_OK=$(docker exec search-opensearch curl -sf http://localhost:9200/_cluster/health 2>/dev/null | grep -c "green\|yellow" || echo "0")
        REDIS_OK=$(docker exec search-redis redis-cli ping 2>/dev/null | grep -c "PONG" || echo "0")
        API_OK=$(docker exec search-api wget -qO- http://localhost:3100/health 2>/dev/null | grep -c "ok" || echo "0")
        
        if [ "$OPENSEARCH_OK" -ge 1 ] && [ "$REDIS_OK" -ge 1 ] && [ "$API_OK" -ge 1 ]; then
            echo ""
            print_success "All critical services are healthy!"
            return 0
        fi
        
        echo -n "."
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done
    
    echo ""
    print_warning "Some services may still be starting. Check with: docker-compose ps"
}

###############################################################################
# Show Status
###############################################################################
show_status() {
    print_header "Deployment Status"
    
    echo -e "${BLUE}Service Status:${NC}"
    docker-compose -f $COMPOSE_FILE ps 2>/dev/null || docker compose -f $COMPOSE_FILE ps
    
    echo ""
    DOMAIN=${DOMAIN:-search.test.mangwale.ai}
    
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}  DEPLOYMENT COMPLETE!${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  • Frontend:       ${GREEN}https://$DOMAIN${NC}"
    echo -e "  • Search API:     ${GREEN}https://$DOMAIN/search${NC}"
    echo -e "  • API Docs:       ${GREEN}https://$DOMAIN/docs${NC}"
    echo -e "  • Health Check:   ${GREEN}https://$DOMAIN/health${NC}"
    echo ""
    echo -e "${BLUE}Local Development:${NC}"
    echo -e "  • API Direct:     ${YELLOW}http://localhost:3100${NC}"
    echo -e "  • Traefik UI:     ${YELLOW}http://localhost:8081${NC}"
    echo -e "  • OpenSearch:     ${YELLOW}http://localhost:9200${NC}"
    echo ""
    echo -e "${BLUE}Quick Commands:${NC}"
    echo -e "  • View logs:      ${YELLOW}docker-compose logs -f${NC}"
    echo -e "  • Stop:           ${YELLOW}docker-compose stop${NC}"
    echo -e "  • Restart:        ${YELLOW}docker-compose restart${NC}"
    echo -e "  • Status:         ${YELLOW}docker-compose ps${NC}"
    echo ""
    echo -e "${BLUE}Test Search:${NC}"
    echo -e "  ${YELLOW}curl 'http://localhost:3100/v2/search?q=pizza&module=food'${NC}"
    echo ""
}

###############################################################################
# Main
###############################################################################
main() {
    print_header "Mangwale Search - One-Click Deployment"
    
    preflight_checks
    setup_environment
    configure_system
    generate_traefik_config
    build_and_deploy
    wait_for_services
    show_status
    
    print_success "Deployment completed successfully!"
}

# Run
main "$@"
