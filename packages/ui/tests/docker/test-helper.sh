#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}🚀 WebDAV Test Environment Setup${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check Docker
if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo -e "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed and running${NC}"

# Check docker-compose
if command_exists docker-compose; then
    COMPOSE_CMD="docker-compose"
elif docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ Docker Compose is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is available${NC}"

# Check Node.js
if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js to generate test data.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js is installed${NC}"

echo ""

# Function to stop the server
stop_server() {
    echo -e "${YELLOW}🛑 Stopping WebDAV server...${NC}"
    cd "$SCRIPT_DIR"
    $COMPOSE_CMD down
    echo -e "${GREEN}✓ Server stopped${NC}"
}

# Function to start the server
start_server() {
    echo -e "${YELLOW}🚀 Starting WebDAV server...${NC}"
    cd "$SCRIPT_DIR"
    
    # Start the container
    $COMPOSE_CMD up -d
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to start WebDAV server${NC}"
        exit 1
    fi
    
    # Wait for server to be ready
    echo -e "${YELLOW}⏳ Waiting for WebDAV server to be ready...${NC}"
    
    # Maximum wait time (30 seconds)
    MAX_WAIT=30
    WAIT_COUNT=0
    
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        if curl -f -u testuser:testpass http://localhost:8080/ > /dev/null 2>&1; then
            echo -e "${GREEN}✓ WebDAV server is ready!${NC}"
            return 0
        fi
        sleep 1
        WAIT_COUNT=$((WAIT_COUNT + 1))
        echo -n "."
    done
    
    echo ""
    echo -e "${RED}❌ WebDAV server failed to start within ${MAX_WAIT} seconds${NC}"
    echo -e "${YELLOW}📋 Checking logs...${NC}"
    $COMPOSE_CMD logs --tail=20
    exit 1
}

# Function to generate test data
generate_data() {
    echo -e "${YELLOW}📝 Generating test data...${NC}"
    cd "$SCRIPT_DIR"
    
    # Run the test data generation script
    node generate-test-data.js
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test data generated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to generate test data${NC}"
        exit 1
    fi
}

# Function to test connection
test_connection() {
    echo -e "${YELLOW}🔍 Testing WebDAV connection...${NC}"
    
    # Test basic authentication
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -u testuser:testpass http://localhost:8080/)
    
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "207" ]; then
        echo -e "${GREEN}✓ Authentication successful${NC}"
    else
        echo -e "${RED}❌ Authentication failed (HTTP $RESPONSE)${NC}"
        return 1
    fi
    
    # Test PROPFIND (WebDAV specific)
    PROPFIND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -u testuser:testpass -X PROPFIND http://localhost:8080/)
    
    if [ "$PROPFIND_RESPONSE" = "207" ]; then
        echo -e "${GREEN}✓ WebDAV PROPFIND working${NC}"
    else
        echo -e "${YELLOW}⚠ WebDAV PROPFIND returned HTTP $PROPFIND_RESPONSE${NC}"
    fi
    
    return 0
}

# Function to show server info
show_info() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${GREEN}✅ WebDAV Test Environment Ready!${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo -e "${BLUE}📌 WebDAV Server Details:${NC}"
    echo -e "   ${GREEN}URL:${NC} http://localhost:8080"
    echo -e "   ${GREEN}Username:${NC} testuser"
    echo -e "   ${GREEN}Password:${NC} testpass"
    echo ""
    echo -e "${BLUE}📁 Test Data Location:${NC}"
    echo -e "   ${GREEN}Local:${NC} $SCRIPT_DIR/test-data"
    echo -e "   ${GREEN}WebDAV:${NC} /"
    echo ""
    echo -e "${BLUE}📊 Test Data Statistics:${NC}"
    if [ -f "$SCRIPT_DIR/test-data/test-data-manifest.json" ]; then
        # Extract stats from manifest
        TOTAL_MD=$(grep '"totalMdFiles"' "$SCRIPT_DIR/test-data/test-data-manifest.json" | grep -o '[0-9]*')
        FOLDERS=$(grep '"folders"' "$SCRIPT_DIR/test-data/test-data-manifest.json" | head -1 | grep -o '[0-9]*')
        echo -e "   ${GREEN}Total .md files:${NC} $TOTAL_MD"
        echo -e "   ${GREEN}Folders:${NC} $FOLDERS"
        echo -e "   ${GREEN}Performance test files:${NC} 1000"
    fi
    echo ""
    echo -e "${BLUE}🛠 Available Commands:${NC}"
    echo -e "   ${GREEN}$0 start${NC}    - Start the WebDAV server"
    echo -e "   ${GREEN}$0 stop${NC}     - Stop the WebDAV server"
    echo -e "   ${GREEN}$0 restart${NC}  - Restart the server"
    echo -e "   ${GREEN}$0 status${NC}   - Check server status"
    echo -e "   ${GREEN}$0 logs${NC}     - View server logs"
    echo -e "   ${GREEN}$0 clean${NC}    - Stop server and remove test data"
    echo -e "   ${GREEN}$0 test${NC}     - Run integration tests"
    echo ""
    echo -e "${BLUE}📝 Next Steps:${NC}"
    echo -e "   1. The WebDAV server is now running at http://localhost:8080"
    echo -e "   2. You can connect to it using any WebDAV client"
    echo -e "   3. Run integration tests with: ${GREEN}npm test${NC}"
    echo -e "   4. View logs with: ${GREEN}$0 logs${NC}"
    echo -e "   5. Stop the server with: ${GREEN}$0 stop${NC}"
    echo ""
}

# Function to check status
check_status() {
    if curl -f -u testuser:testpass http://localhost:8080/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ WebDAV server is running${NC}"
        echo -e "   URL: http://localhost:8080"
        echo -e "   Username: testuser"
        echo -e "   Password: testpass"
        return 0
    else
        echo -e "${YELLOW}○ WebDAV server is not running${NC}"
        echo -e "   Start it with: $0 start"
        return 1
    fi
}

# Function to view logs
view_logs() {
    cd "$SCRIPT_DIR"
    echo -e "${BLUE}📋 WebDAV Server Logs:${NC}"
    $COMPOSE_CMD logs -f
}

# Function to clean everything
clean_all() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    cd "$SCRIPT_DIR"
    
    # Stop container
    $COMPOSE_CMD down
    
    # Remove test data
    if [ -d "$SCRIPT_DIR/test-data" ]; then
        echo -e "${YELLOW}Removing test data...${NC}"
        rm -rf "$SCRIPT_DIR/test-data"
    fi
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}🧪 Running integration tests...${NC}"
    
    # Check if server is running
    if ! curl -f -u testuser:testpass http://localhost:8080/ > /dev/null 2>&1; then
        echo -e "${YELLOW}Starting WebDAV server first...${NC}"
        start_server
        generate_data
    fi
    
    # Run the integration tests
    cd "$SCRIPT_DIR/../.."
    npm test -- --run FileTree.integration
}

# Main command handling
case "${1:-}" in
    start)
        start_server
        generate_data
        test_connection
        show_info
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        echo ""
        start_server
        test_connection
        show_info
        ;;
    status)
        check_status
        ;;
    logs)
        view_logs
        ;;
    clean)
        clean_all
        ;;
    test)
        run_tests
        ;;
    "")
        # Default action: start everything
        start_server
        generate_data
        test_connection
        show_info
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        echo "Usage: $0 [start|stop|restart|status|logs|clean|test]"
        echo ""
        echo "Commands:"
        echo "  start    - Start the WebDAV server"
        echo "  stop     - Stop the WebDAV server"
        echo "  restart  - Restart the server"
        echo "  status   - Check if server is running"
        echo "  logs     - View server logs"
        echo "  clean    - Stop server and remove test data"
        echo "  test     - Run integration tests"
        echo ""
        echo "If no command is provided, the script will start the server and generate test data."
        exit 1
        ;;
esac