.PHONY: db db-stop db-destroy build start local setup clean help

COMPOSE := docker compose --env-file container.env

db: ## Start the PostgreSQL database
	$(COMPOSE) up -d db
	@echo "Waiting for database to be ready..."
	@until docker exec $$($(COMPOSE) ps -q db) pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "Database is ready."

db-stop: ## Stop the database without removing data
	$(COMPOSE) stop db

db-destroy: ## Stop and remove the database container and data
	$(COMPOSE) down -v
	rm -rf postgres-data
	@echo "Database container and data removed."

setup: db ## Install dependencies and run migrations
	npm ci
	npx prisma migrate deploy
	npx prisma generate

build: ## Build the Next.js production bundle
	npm run build

start: db ## Start the production server (starts db if needed)
	npm run start

local: db ## Start the dev server with hot reload (starts db if needed)
	npm run dev

clean: ## Remove build artifacts
	rm -rf .next

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
