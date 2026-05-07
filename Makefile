.PHONY: help dev build clean install-hooks lint fmt test pages-preview

help: ## Show all targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Run local dev server
	npx vite --open

build: ## Build frontend into docs/ (Pages-ready)
	npx vite build

clean: ## Remove build artifacts
	rm -rf docs/assets docs/index.html docs/404.html docs/favicon.svg docs/manifest.json

lint: ## Run linters
	npx tsc --noEmit

fmt: ## Auto-format code
	npx prettier --write "src/**/*.{ts,css,html}"

test: ## Run unit tests
	@echo "No tests configured yet"

pages-preview: build ## Serve docs/ locally as GitHub Pages would
	npx serve docs -l 3000

install-hooks: ## Set up git hooks
	@echo "Git hooks not yet configured for Mode A"
