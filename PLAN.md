# QA-Use Development Plan

## 📋 Backlog

### Setup & Infrastructure
- [x] Initialize Node.js project with package.json
- [x] Setup TypeScript configuration
- [x] Install core dependencies (Playwright, tasuku, ink, etc.)
- [x] Setup project structure and folders
- [x] Configure linting and formatting (ESLint, Prettier)

### CLI Foundation
- [x] Create main CLI entry point with commander.js
- [x] Add interactive UI with ASCII art branding
- [x] Implement auth command structure
- [x] Implement logout command structure
- [x] Implement config command structure
- [x] Implement forward command structure
- [x] Add help and version commands
- [x] Setup configuration file handling (~/.qa-use/config.json)
- [x] Add slash command interface in interactive mode

### Authentication & Registration
- [x] Create API key validation logic
- [x] Implement registration flow (API-based with email)
- [x] Add environment configuration (prod/local API endpoints)
- [ ] Create config wizard for init command

### Browser Management
- [x] Implement Playwright browser launch
- [x] Setup browser WebSocket endpoint extraction
- [x] Integrate localtunnel for port forwarding
- [x] Add browser lifecycle management (start/stop/cleanup)

### Git Integration
- [x] Setup git repository detection
- [x] Implement file change monitoring with chokidar
- [x] Create git diff analysis
- [x] Add file filtering (gitignore support, ignore node_modules, etc.)

### AI Integration
- [ ] Setup Vercel AI SDK
- [ ] Implement AI provider configuration (OpenRouter, OpenAI, Anthropic, Gemini)
- [ ] Create change summary generation logic
- [ ] Add prompt engineering for code change analysis

### API Communication
- [x] Implement session management with desplega.ai API
- [x] Create TypeScript types for API models
- [x] Add session creation, listing, and detail fetching
- [ ] Implement WebSocket connection to desplega.ai
- [ ] Create message protocol handlers
- [ ] Add connection retry logic
- [ ] Implement event broadcasting to API

### UI & UX
- [ ] Design CLI interface with ink components
- [ ] Add progress indicators with tasuku
- [ ] Create status dashboard
- [ ] Add error handling and user feedback

## 🚧 In Progress

*(Move items here when actively working on them)*

## ✅ Done

- [x] Write initial PRD
- [x] Refine PRD with clear features and user flow
- [x] Add API authentication and environment configuration
- [x] Create development plan
- [x] Initialize Node.js project with package.json
- [x] Setup TypeScript configuration
- [x] Install core dependencies (Playwright, tasuku, ink, etc.)
- [x] Setup project structure and folders
- [x] Create main CLI entry point with commander.js
- [x] Add interactive UI with ASCII art branding
- [x] Implement auth, logout, config, forward command structures
- [x] Add help and version commands
- [x] Configure linting and formatting (ESLint, Prettier)
- [x] Setup Makefile for build automation
- [x] Implement complete authentication system with API integration
- [x] Create browser forwarding with Playwright + localtunnel
- [x] Add file watcher with gitignore support and smart event detection
- [x] Setup environment configuration with .env support
- [x] Add interactive mode with slash commands and tab completion
- [x] Implement proper error handling and graceful shutdowns
- [x] Implement git integration with repository detection and diff analysis
- [x] Create session management API with TypeScript types
- [x] Fix file watcher with proper chokidar configuration

## 🧪 Testing

### Unit Tests
- [ ] CLI command parsing tests
- [ ] Configuration handling tests
- [ ] Git change detection tests
- [ ] AI summary generation tests

### Integration Tests
- [ ] End-to-end workflow tests
- [ ] API connection tests
- [ ] Browser automation tests
- [ ] File watching tests

### Manual Testing
- [ ] Test with real desplega.ai API
- [ ] Verify browser port forwarding
- [ ] Test git change detection in real repos
- [ ] Validate AI summaries quality

## 🚀 Release

### Documentation
- [ ] Write README with installation instructions
- [ ] Create usage examples
- [ ] Document configuration options
- [ ] Add troubleshooting guide

### Packaging
- [ ] Setup npm package configuration
- [ ] Create build scripts
- [ ] Add CLI binary setup
- [ ] Test installation process

### Distribution
- [ ] Publish to npm registry
- [ ] Create GitHub releases
- [ ] Setup CI/CD pipeline
- [ ] Add automated testing

---

## Notes
- Move items between columns as you work
- Add new items to Backlog as needed
- Break down large items into smaller tasks
- Update progress regularly