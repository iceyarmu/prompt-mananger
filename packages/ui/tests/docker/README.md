# WebDAV Test Environment for File Tree Component

This directory contains a Docker-based WebDAV test environment for comprehensive testing of the File Tree component with real WebDAV integration.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Node.js (v18+) installed
- Port 8080 available on localhost

## 🚀 Quick Start

```bash
# Navigate to this directory
cd packages/ui/tests/docker

# Start the WebDAV server and generate test data
./test-helper.sh start

# The server is now running at http://localhost:8080
# Username: testuser
# Password: testpass
```

## 📁 Directory Structure

```
docker/
├── docker-compose.yml       # Docker Compose configuration
├── generate-test-data.js    # Test data generation script
├── test-helper.sh          # Helper script for easy management
├── test-data/              # Generated test data (created automatically)
│   ├── documents/          # Document files and folders
│   ├── notes/              # Notes and daily logs
│   ├── templates/          # Template files
│   ├── archive/            # Archived content
│   ├── performance-test/   # 1000+ files for performance testing
│   └── edge-cases/         # Edge case test files
└── README.md              # This file
```

## 🛠 Available Commands

### Start the Server
```bash
./test-helper.sh start
# or just
./test-helper.sh
```
Starts the WebDAV server and generates test data if not already present.

### Stop the Server
```bash
./test-helper.sh stop
```
Stops the running WebDAV container.

### Restart the Server
```bash
./test-helper.sh restart
```
Restarts the WebDAV server.

### Check Status
```bash
./test-helper.sh status
```
Checks if the WebDAV server is running.

### View Logs
```bash
./test-helper.sh logs
```
Shows real-time logs from the WebDAV server.

### Clean Everything
```bash
./test-helper.sh clean
```
Stops the server and removes all test data.

### Run Integration Tests
```bash
./test-helper.sh test
```
Runs the File Tree integration tests against the real WebDAV server.

## 📊 Test Data

The test environment generates comprehensive test data:

- **Regular Files**: ~15 realistic .md files with actual content
- **Performance Test Files**: 1000 .md files in batches for performance testing
- **Edge Cases**: 
  - Deep folder nesting (7+ levels)
  - Special characters in filenames
  - Empty folders
  - Mixed content (filtered non-.md files)
- **Total**: 1000+ .md files across 40+ folders

### Test Data Categories

1. **Documents** (`/documents/`)
   - Project documentation
   - User guides
   - Project specifications

2. **Notes** (`/notes/`)
   - Daily notes with dates
   - Meeting notes
   - Ideas and thoughts

3. **Templates** (`/templates/`)
   - Bug report template
   - Feature request template
   - Documentation templates

4. **Archive** (`/archive/`)
   - Quarterly reports
   - Historical data

5. **Performance Test** (`/performance-test/`)
   - 10 batches
   - 100 files per batch
   - Total: 1000 files for stress testing

6. **Edge Cases** (`/edge-cases/`)
   - Deep nesting test
   - Special character handling
   - Empty folders
   - Non-.md file filtering

## 🧪 Running Tests

### Manual Testing

1. Start the WebDAV server:
   ```bash
   ./test-helper.sh start
   ```

2. Run the integration tests:
   ```bash
   # From the packages/ui directory
   npm test -- --run FileTree.real-webdav
   ```

### Automated Testing

The integration tests will automatically detect if the WebDAV server is running and skip tests if not available.

```javascript
// Tests will check for server availability
// If not available, tests will be skipped with a warning
```

## 🔧 Configuration

### WebDAV Server Settings

Edit `docker-compose.yml` to modify:
- Port mapping (default: 8080)
- Authentication credentials
- Volume mounts

Default credentials:
- **URL**: http://localhost:8080
- **Username**: testuser
- **Password**: testpass
- **Auth Type**: Basic

### Test Data Generation

Edit `generate-test-data.js` to modify:
- Number of performance test files
- Folder structure
- File content templates

## 📈 Performance Benchmarks

The test environment is designed to validate performance requirements:

| Metric | Target | Typical Result |
|--------|--------|----------------|
| Initial Load | < 3s | ~1.5s |
| 1000+ Files Load | < 5s | ~3s |
| Search Response | < 500ms | ~200ms |
| Scroll FPS | 60 FPS | 60 FPS |

## 🔍 Troubleshooting

### Docker Issues

**Problem**: Docker is not running
```bash
# Start Docker Desktop or Docker daemon
# On macOS: Open Docker Desktop
# On Linux: sudo systemctl start docker
```

**Problem**: Port 8080 is already in use
```bash
# Find process using port 8080
lsof -i :8080

# Or change the port in docker-compose.yml
ports:
  - "8081:80"  # Use 8081 instead
```

### WebDAV Connection Issues

**Problem**: Cannot connect to WebDAV server
```bash
# Check if container is running
docker ps | grep webdav

# Check container logs
docker logs prompt-optimizer-webdav-test

# Test connection manually
curl -u testuser:testpass http://localhost:8080/
```

### Test Data Issues

**Problem**: Test data not generated
```bash
# Generate manually
node generate-test-data.js

# Check for errors
ls -la test-data/
```

## 🚦 CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      webdav:
        image: bytemark/webdav
        ports:
          - 8080:80
        env:
          AUTH_TYPE: Basic
          USERNAME: testuser
          PASSWORD: testpass
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Generate test data
        run: |
          cd packages/ui/tests/docker
          node generate-test-data.js
      
      - name: Run integration tests
        run: |
          cd packages/ui
          npm test -- --run FileTree.real-webdav
```

### Local CI Testing

```bash
# Run all tests including WebDAV integration
./test-helper.sh start
npm test
./test-helper.sh stop
```

## 📝 Notes

- The WebDAV server uses the `bytemark/webdav` Docker image
- Test data is generated locally and mounted into the container
- The server supports standard WebDAV operations (PROPFIND, GET, PUT, DELETE)
- Virtual scrolling activates automatically for trees with >100 items
- All non-.md files are filtered out by the File Tree component

## 🔗 Related Documentation

- [File Tree Story](../../docs/drafts/1.4.file-tree.story.md)
- [WebDAV Service](../../../webdav/README.md)
- [UI Components](../../README.md)

## 📄 License

This test environment is part of the Prompt Optimizer project and follows the same MIT license.