# AION Reverse-Connect Gateway - Makefile
#
# Common workflows:
#   make dev          - run gateway locally with stub SDKs
#   make build        - build binary (auto-detects available SDKs)
#   make build-full   - build with both SDKs; fails if either missing
#   make test         - unit tests
#   make test-int     - integration tests (needs Docker)
#   make lint         - go vet + staticcheck + gosec
#   make image        - docker image (stub SDKs)
#   make image-full   - docker image (with SDKs via BuildKit secrets)
#   make migrate      - apply migrations/*.sql to $AION_PG_DSN
#   make rollback     - drop schema reverse (DESTRUCTIVE, asks confirmation)
#   make keygen       - generate a KEK and print to stdout

SHELL          := /usr/bin/env bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

GIT_SHA        ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
VERSION        ?= v1.1.0-reverse-connect
BIN            := ./bin/gateway
MODULE         := github.com/claveseg/aion/reverse-gateway

SDK_DAHUA_LIB  := ./sdks/dahua/lib/libdhnetsdk.so
SDK_HIK_LIB    := ./sdks/hikvision/lib/libhcnetsdk.so

# Auto-detect build tags based on SDK presence
TAGS :=
ifneq ("$(wildcard $(SDK_DAHUA_LIB))","")
  TAGS += sdk_dahua
endif
ifneq ("$(wildcard $(SDK_HIK_LIB))","")
  TAGS += sdk_hikvision
endif
TAGS_FLAG := $(if $(strip $(TAGS)),-tags "$(strip $(TAGS))",)

LDFLAGS := -s -w -X main.version=$(VERSION)-$(GIT_SHA)

CGO_CFLAGS  ?= -I$(CURDIR)/sdks/dahua/include -I$(CURDIR)/sdks/hikvision/include
CGO_LDFLAGS ?= -L$(CURDIR)/sdks/dahua/lib -L$(CURDIR)/sdks/hikvision/lib \
               -Wl,-rpath=$(CURDIR)/sdks/dahua/lib \
               -Wl,-rpath=$(CURDIR)/sdks/hikvision/lib

.PHONY: help
help:
	@awk 'BEGIN {FS=":.*##"} /^[a-zA-Z0-9_-]+:.*##/{printf "  \033[36m%-15s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)

.PHONY: deps
deps: ## Download Go module dependencies
	go mod download
	go mod tidy

.PHONY: dev
dev: ## Run gateway locally with whatever SDKs are available
	@echo "Tags: $(TAGS)"
	CGO_ENABLED=1 CGO_CFLAGS='$(CGO_CFLAGS)' CGO_LDFLAGS='$(CGO_LDFLAGS)' \
	go run $(TAGS_FLAG) ./cmd/gateway --config ./configs/gateway.dev.toml

.PHONY: build
build: ## Build binary (auto-detects SDKs)
	@echo "Tags: $(TAGS)"
	@mkdir -p bin
	CGO_ENABLED=1 CGO_CFLAGS='$(CGO_CFLAGS)' CGO_LDFLAGS='$(CGO_LDFLAGS)' \
	go build -trimpath $(TAGS_FLAG) -ldflags '$(LDFLAGS)' -o $(BIN) ./cmd/gateway
	@ls -lh $(BIN)

.PHONY: build-full
build-full: ## Build with BOTH SDKs; fails if either missing
	@test -f $(SDK_DAHUA_LIB)  || (echo "ERROR: Dahua SDK missing at $(SDK_DAHUA_LIB)"; exit 1)
	@test -f $(SDK_HIK_LIB)    || (echo "ERROR: Hikvision SDK missing at $(SDK_HIK_LIB)"; exit 1)
	@$(MAKE) build

.PHONY: test
test: ## Unit tests
	go test -race -cover ./internal/... ./test/unit/...

.PHONY: test-int
test-int: ## Integration tests (requires Docker)
	go test -race -tags integration ./test/integration/...

.PHONY: test-cov
test-cov: ## Coverage report -> coverage.html
	go test -race -coverprofile=coverage.out -covermode=atomic ./internal/... ./test/unit/...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Open coverage.html in a browser."

.PHONY: lint
lint: ## go vet + staticcheck + gosec
	go vet ./...
	@command -v staticcheck >/dev/null && staticcheck ./... || echo "staticcheck not installed; skipping"
	@command -v gosec       >/dev/null && gosec -quiet ./... || echo "gosec not installed; skipping"

.PHONY: image
image: ## Build Docker image with stub SDKs
	docker build \
	  --build-arg GIT_SHA=$(GIT_SHA) \
	  --build-arg BUILD_SDKS=0 \
	  -t aion/reverse-gateway:$(VERSION) \
	  -t aion/reverse-gateway:latest .

.PHONY: image-full
image-full: ## Build Docker image WITH SDKs (requires ./sdks/*.tar.gz)
	@test -f ./sdks/dahua.tar.gz     || (echo "sdks/dahua.tar.gz missing"; exit 1)
	@test -f ./sdks/hikvision.tar.gz || (echo "sdks/hikvision.tar.gz missing"; exit 1)
	DOCKER_BUILDKIT=1 docker build \
	  --build-arg GIT_SHA=$(GIT_SHA) \
	  --build-arg BUILD_SDKS=1 \
	  --secret id=dahua_sdk,src=./sdks/dahua.tar.gz \
	  --secret id=hik_sdk,src=./sdks/hikvision.tar.gz \
	  -t aion/reverse-gateway:$(VERSION)-full \
	  -t aion/reverse-gateway:latest-full .

.PHONY: migrate
migrate: ## Apply migrations/*.sql to $AION_PG_DSN
	@test -n "$${AION_PG_DSN:-}" || (echo "AION_PG_DSN not set"; exit 1)
	@for f in migrations/*.sql; do \
	  echo "--> $$f"; \
	  psql "$$AION_PG_DSN" -v ON_ERROR_STOP=1 -f "$$f"; \
	done

.PHONY: rollback
rollback: ## DROP SCHEMA reverse CASCADE (DESTRUCTIVE)
	@test -n "$${AION_PG_DSN:-}" || (echo "AION_PG_DSN not set"; exit 1)
	@echo "!!! This will DROP SCHEMA reverse CASCADE on $${AION_PG_DSN}"; \
	read -p "Type DROP to confirm: " ans; \
	[ "$$ans" = "DROP" ] || (echo "aborted"; exit 1); \
	psql "$$AION_PG_DSN" -c "DROP SCHEMA IF EXISTS reverse CASCADE"

.PHONY: keygen
keygen: ## Generate a fresh KEK to stdout (redirect to file with 0400)
	@go run ./cmd/keygen

.PHONY: proto
proto: ## Regenerate gRPC stubs from proto/reverse_gateway.proto
	@command -v buf >/dev/null || (echo "buf not installed"; exit 1)
	buf generate

.PHONY: clean
clean:
	rm -rf bin coverage.out coverage.html
