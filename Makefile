.PHONY: format lint build all clean help

# Default target
all: format lint build

# Format code using prettier
format:
	@echo "🎨 Formatting code..."
	pnpm run format

# Check formatting without making changes
format-check:
	@echo "🔍 Checking code formatting..."
	pnpm run format:check

# Lint code using eslint
lint:
	@echo "🔍 Linting code..."
	pnpm run lint

# Fix linting issues automatically
lint-fix:
	@echo "🔧 Fixing lint issues..."
	pnpm run lint:fix

# Build the project
build:
	@echo "🔨 Building project..."
	pnpm run build

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist/

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	pnpm install

# Development mode
dev:
	@echo "🚀 Starting development server..."
	pnpm run dev

# Help
help:
	@echo "Available targets:"
	@echo "  all          - Format, lint, and build (default)"
	@echo "  format       - Format code with prettier"
	@echo "  format-check - Check formatting without changes"
	@echo "  lint         - Lint code with eslint"
	@echo "  lint-fix     - Fix linting issues automatically"
	@echo "  build        - Build the project"
	@echo "  clean        - Clean build artifacts"
	@echo "  install      - Install dependencies"
	@echo "  dev          - Start development server"
	@echo "  help         - Show this help message"