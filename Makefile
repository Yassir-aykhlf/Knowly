SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
ENV_FILE ?= $(ROOT)/.env
ENV_PATH := $(abspath $(ENV_FILE))
MODE ?= docker
UV ?= uv
NPM ?= npm
PYTHON ?= $(ROOT)/backend/.venv/bin/python
BUILD_CA_CERT ?= $(if $(CODEX_PROXY_CERT),/etc/ssl/certs/ca-certificates.crt)
export BUILD_CA_CERT
COMPOSE_FILES := -f "$(ROOT)/docker-compose.yml"
ifneq ($(wildcard $(ROOT)/docker-compose.override.yml),)
COMPOSE_FILES += -f "$(ROOT)/docker-compose.override.yml"
endif
ifneq ($(strip $(BUILD_CA_CERT)),)
COMPOSE_FILES += -f "$(ROOT)/docker-compose.ca.yml"
endif
COMPOSE := docker compose --project-directory "$(ROOT)" --env-file "$(ENV_PATH)" $(COMPOSE_FILES)
DEV_COMPOSE := $(COMPOSE) -f "$(ROOT)/docker-compose.dev.yml"
SEED_ARGS ?=
TEST_ARGS ?= -q
REVISION ?= head
MESSAGE ?=
SERVICE ?=
PORT ?= 8000

ifeq ($(MODE),local)
BACKEND = cd "$(ROOT)/backend" && "$(PYTHON)" "$(ROOT)/scripts/with-env.py" --env-file "$(ENV_PATH)" -- "$(PYTHON)"
TEST_BACKEND = cd "$(ROOT)/backend" && "$(PYTHON)" "$(ROOT)/scripts/with-env.py" --env-file "$(ENV_PATH)" --test -- "$(PYTHON)"
DB_DEP :=
else ifeq ($(MODE),docker)
BACKEND = $(COMPOSE) run --rm --no-deps --entrypoint python backend
TEST_BACKEND = $(COMPOSE) run --rm --no-deps -v "$(ROOT)/scripts:/tools:ro" --entrypoint python backend /tools/with-env.py --test -- python
DB_DEP := db
else
$(error MODE must be docker or local)
endif

.PHONY: help env check-env certs setup run install install-backend install-frontend \
        build build-frontend up dev stop down restart logs ps db db-shell \
        migrate migration migrations seed test test-backend test-tools typecheck backend frontend

help:
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' "$(ROOT)/Makefile"

env:
	@if [ ! -e "$(ENV_PATH)" ]; then (umask 077; cp -n "$(ROOT)/env.example" "$(ENV_PATH)"); fi

check-env:
ifeq ($(MODE),local)
	@cd "$(ROOT)" && "$(PYTHON)" scripts/with-env.py --env-file "$(ENV_PATH)" -- bash scripts/check-env.sh
else
	@$(COMPOSE) config --quiet
	@$(COMPOSE) run --rm --no-deps --entrypoint bash backend /app/scripts/check-env.sh
endif

certs: 
	@bash "$(ROOT)/scripts/generate-cert.sh"

setup: env certs install 

run: env certs
	@$(COMPOSE) up -d --build --wait backend
	@$(COMPOSE) up -d --build nginx
	@$(COMPOSE) exec -T backend python -m app.seed $(SEED_ARGS)

install: install-backend install-frontend

install-backend:
	@cd "$(ROOT)/backend" && $(UV) sync --frozen --extra test

install-frontend:
	@cd "$(ROOT)/frontend" && $(NPM) ci

build:
	@$(COMPOSE) build

build-frontend:
	@cd "$(ROOT)/frontend" && $(NPM) run build

up: env certs 
	@$(COMPOSE) up -d --build

dev: env certs 
	@$(DEV_COMPOSE) up -d --build

stop: 
	@$(COMPOSE) stop

down: 
	@$(COMPOSE) down

restart:
	@$(COMPOSE) restart $(SERVICE)

logs:
	@$(COMPOSE) logs --tail=100 -f $(SERVICE)

ps:
	@$(COMPOSE) ps

db: env
	@$(COMPOSE) up -d --wait db

db-shell: db
	@$(COMPOSE) exec db sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

migrate: $(DB_DEP)
	@$(BACKEND) -m alembic upgrade "$(REVISION)"

migration:
	@test -n "$(MESSAGE)" || { echo 'Set MESSAGE="migration description"' >&2; exit 1; }
	@cd "$(ROOT)/backend" && "$(PYTHON)" "$(ROOT)/scripts/with-env.py" --env-file "$(ENV_PATH)" -- "$(PYTHON)" -m alembic revision --autogenerate -m "$(MESSAGE)"

migrations:
	@$(BACKEND) -m alembic current

seed: migrate
	@$(BACKEND) -m app.seed $(SEED_ARGS)

test: test-backend test-tools typecheck

test-backend: $(DB_DEP)
	@$(TEST_BACKEND) -m pytest $(TEST_ARGS)

test-tools:
	@cd "$(ROOT)" && "$(PYTHON)" -m pytest -q tests

typecheck:
	@cd "$(ROOT)/frontend" && $(NPM) run typecheck

backend:
	@cd "$(ROOT)/backend" && "$(PYTHON)" "$(ROOT)/scripts/with-env.py" --env-file "$(ENV_PATH)" -- "$(PYTHON)" -m uvicorn app.main:app --reload --host 127.0.0.1 --port "$(PORT)"

frontend:
	@cd "$(ROOT)/frontend" && "$(PYTHON)" "$(ROOT)/scripts/with-env.py" --env-file "$(ENV_PATH)" -- $(NPM) run dev -- $(VITE_ARGS)
