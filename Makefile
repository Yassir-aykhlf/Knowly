COMPOSE := docker compose

.PHONY: run seed logs down

run: .env certs/cert.pem
	$(COMPOSE) up -d --build

seed:
	$(COMPOSE) exec -T backend python -m app.seed

logs:
	$(COMPOSE) logs -f --tail=100

down:
	$(COMPOSE) down

.env:
	cp env.example .env

certs/cert.pem:
	bash scripts/generate-cert.sh
