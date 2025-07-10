# DIDComm Mediator Load Testing Makefile
# Usage examples:
#   make test-basic
#   make test-custom WALLETS=500 DURATION=60 RATE=10
#   make test-ramp START=5 END=50 DURATION=120
#   make stress-test
#   make report FILE=results.json

# Default values
WALLETS ?= 100
DURATION ?= 30
RATE ?= 5
START_RATE ?= 2
END_RATE ?= 20
TARGET ?= https://animo-mediator-qa.ngotag.com

# Cloud and dashboard options
CLOUD ?= false
UI ?= false
NAME ?= "DIDComm Load Test"
TAGS ?= "environment:qa,service:mediator"

# Colors for output
RED    = \033[0;31m
GREEN  = \033[0;32m
YELLOW = \033[0;33m
BLUE   = \033[0;34m
PURPLE = \033[0;35m
CYAN   = \033[0;36m
NC     = \033[0m # No Color

.PHONY: help install test-basic test-custom test-ramp test-burst test-sustained stress-test report clean

# Default target
help:
	@echo "$(CYAN)DIDComm Mediator Load Testing$(NC)"
	@echo ""
	@echo "$(YELLOW)Basic Tests:$(NC)"
	@echo "  make test-basic                    - Run basic test (10 wallets)"
	@echo "  make test-medium                   - Run medium test (100 wallets)"  
	@echo "  make test-large                    - Run large test (500 wallets)"
	@echo ""
	@echo "$(YELLOW)Custom Tests:$(NC)"
	@echo "  make test-custom WALLETS=N         - Custom wallet count"
	@echo "  make test-custom RATE=N DURATION=N - Custom rate and duration"
	@echo "  make test-ramp START=N END=N       - Ramp test with custom rates"
	@echo ""
	@echo "$(YELLOW)Predefined Tests:$(NC)"
	@echo "  make test-burst                    - Burst test (high load quickly)"
	@echo "  make test-sustained                - Sustained test (long duration)"
	@echo "  make stress-test                   - Stress test (maximum load)"
	@echo ""
	@echo "$(YELLOW)Reports:$(NC)"
	@echo "  make report                        - Generate HTML report from last run"
	@echo "  make report FILE=results.json      - Generate report from specific file"
	@echo "  make dashboard                     - Open Artillery dashboard"
	@echo ""
	@echo "$(YELLOW)Utilities:$(NC)"
	@echo "  make install                       - Install dependencies"
	@echo "  make clean                         - Clean up reports"
	@echo "  make check-mediator               - Check if mediator is responding"
	@echo ""
	@echo "$(YELLOW)Cloud & Dashboard:$(NC)"
	@echo "  make test-custom CLOUD=true          - Run with Artillery Cloud"
	@echo "  make test-custom UI=true             - Run with real-time dashboard"
	@echo "  make dashboard-setup                 - Setup Artillery Cloud login"
	@echo "  make interactive-cloud               - Interactive test with cloud"
	@echo ""
	@echo "$(YELLOW)Examples:$(NC)"
	@echo "  make test-custom WALLETS=250 DURATION=45 RATE=8"
	@echo "  make test-ramp START=5 END=30 DURATION=90"

# Install dependencies
install:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install

# Check if mediator is responding
check-mediator:
	@echo "$(BLUE)Checking mediator status...$(NC)"
	@curl -I $(TARGET) 2>/dev/null | head -1 || echo "$(RED)Mediator not responding$(NC)"

# Basic predefined tests
test-basic:
	@echo "$(GREEN)Running basic test (10 wallets)...$(NC)"
	npx artillery run tests/basic.yml --output results-basic-$(shell date +%Y%m%d-%H%M%S).json

test-medium:
	@echo "$(GREEN)Running medium test (100 wallets)...$(NC)"
	@$(MAKE) test-custom WALLETS=100 DURATION=30 RATE=5

test-large:
	@echo "$(GREEN)🧪 Running large test (500 wallets)...$(NC)"
	@$(MAKE) test-custom WALLETS=500 DURATION=60 RATE=10

# Custom test with user parameters
test-custom:
	@echo "$(GREEN)🧪 Running custom test...$(NC)"
	@echo "$(YELLOW)Parameters:$(NC)"
	@echo "  Target Wallets: $(WALLETS)"
	@echo "  Duration: $(DURATION)s"
	@echo "  Rate: $(RATE) wallets/sec"
	@echo "  Expected Total: ~$$(echo '$(RATE) * $(DURATION)' | bc) wallets"
	@echo ""
	@TIMESTAMP=$$(date +%Y%m%d-%H%M%S) && \
	OUTPUT_FILE="results-custom-$(WALLETS)w-$$TIMESTAMP.json" && \
	echo "config:" > temp-config.yml && \
	echo "  target: \"$(TARGET)\"" >> temp-config.yml && \
	echo "  phases:" >> temp-config.yml && \
	echo "    - duration: $(DURATION)" >> temp-config.yml && \
	echo "      arrivalRate: $(RATE)" >> temp-config.yml && \
	echo "  processor: \"./tests/processor.js\"" >> temp-config.yml && \
	echo "  environments:" >> temp-config.yml && \
	echo "    NODE_NO_WARNINGS: 1" >> temp-config.yml && \
	echo "" >> temp-config.yml && \
	echo "scenarios:" >> temp-config.yml && \
	echo "  - name: \"Custom Load Test ($(WALLETS) wallets)\"" >> temp-config.yml && \
	echo "    flow:" >> temp-config.yml && \
	echo "      - function: \"connectToMediator\"" >> temp-config.yml && \
	ARTILLERY_ARGS="temp-config.yml --output $$OUTPUT_FILE"; \
	if [ "$(CLOUD)" = "true" ]; then \
		ARTILLERY_ARGS="$$ARTILLERY_ARGS --record --name '$(NAME)' --tags '$(TAGS)'"; \
		echo "$(CYAN)Cloud reporting enabled$(NC)"; \
	fi; \
	if [ "$(UI)" = "true" ]; then \
		echo "$(YELLOW)Real-time UI requires Artillery Pro$(NC)"; \
		echo "$(CYAN)Install: npm install -g @artilleryio/artillery-pro$(NC)"; \
		echo "$(CYAN)Then use: artillery pro run instead of artillery run$(NC)"; \
	fi; \
	npx artillery run $$ARTILLERY_ARGS && \
	rm temp-config.yml && \
	echo "$(GREEN)Test completed! Report saved to: $$OUTPUT_FILE$(NC)" && \
	echo "$(CYAN)Generate HTML report: make report FILE=$$OUTPUT_FILE$(NC)"

# Ramp test with custom start/end rates
test-ramp:
	@echo "$(GREEN)🧪 Running ramp test...$(NC)"
	@echo "$(YELLOW)Parameters:$(NC)"
	@echo "  Start Rate: $(START_RATE) wallets/sec"
	@echo "  End Rate: $(END_RATE) wallets/sec"
	@echo "  Duration: $(DURATION)s"
	@echo "  Expected Total: ~$$(echo '($(START_RATE) + $(END_RATE)) * $(DURATION) / 2' | bc) wallets"
	@echo ""
	@TIMESTAMP=$$(date +%Y%m%d-%H%M%S) && \
	OUTPUT_FILE="results-ramp-$(START_RATE)to$(END_RATE)-$$TIMESTAMP.json" && \
	echo "config:" > temp-ramp.yml && \
	echo "  target: \"$(TARGET)\"" >> temp-ramp.yml && \
	echo "  phases:" >> temp-ramp.yml && \
	echo "    - duration: $(DURATION)" >> temp-ramp.yml && \
	echo "      arrivalRate: $(START_RATE)" >> temp-ramp.yml && \
	echo "      rampTo: $(END_RATE)" >> temp-ramp.yml && \
	echo "  processor: \"./tests/processor.js\"" >> temp-ramp.yml && \
	echo "  environments:" >> temp-ramp.yml && \
	echo "    NODE_NO_WARNINGS: 1" >> temp-ramp.yml && \
	echo "" >> temp-ramp.yml && \
	echo "scenarios:" >> temp-ramp.yml && \
	echo "  - name: \"Ramp Test ($(START_RATE)-$(END_RATE) wallets/s)\"" >> temp-ramp.yml && \
	echo "    flow:" >> temp-ramp.yml && \
	echo "      - function: \"connectToMediator\"" >> temp-ramp.yml && \
	ARTILLERY_ARGS="temp-ramp.yml --output $$OUTPUT_FILE"; \
	if [ "$(CLOUD)" = "true" ]; then \
		ARTILLERY_ARGS="$$ARTILLERY_ARGS --record --name 'Ramp Test $(START_RATE)-$(END_RATE)' --tags '$(TAGS),type:ramp'"; \
	fi; \
	if [ "$(UI)" = "true" ]; then \
		echo "$(YELLOW)Real-time UI requires Artillery Pro$(NC)"; \
		echo "$(CYAN)Install: npm install -g @artilleryio/artillery-pro$(NC)"; \
	fi; \
	npx artillery run $$ARTILLERY_ARGS && \
	rm temp-ramp.yml && \
	echo "$(GREEN)Ramp test completed! Report: $$OUTPUT_FILE$(NC)"

# Predefined test scenarios
test-burst:
	@echo "$(GREEN)Running burst test (500 wallets in 10 seconds)...$(NC)"
	npx artillery run tests/burst.yml --output results-burst-$(shell date +%Y%m%d-%H%M%S).json

test-sustained:
	@echo "$(GREEN)🧪 Running sustained test (6000 wallets over 5 minutes)...$(NC)"
	npx artillery run tests/sustained.yml --output results-sustained-$(shell date +%Y%m%d-%H%M%S).json

stress-test:
	@echo "$(RED)Running stress test (MAXIMUM LOAD)...$(NC)"
	@echo "$(YELLOW)This will create 15,000+ wallet connections!$(NC)"
	@read -p "Are you sure? (y/N): " confirm && [ $$confirm = y ] || exit 1
	npx artillery run tests/stress.yml --output results-stress-$(shell date +%Y%m%d-%H%M%S).json

# Quick tests with different scales
quick-10:
	@$(MAKE) test-custom WALLETS=10 DURATION=5 RATE=2

quick-50:
	@$(MAKE) test-custom WALLETS=50 DURATION=10 RATE=5

quick-100:
	@$(MAKE) test-custom WALLETS=100 DURATION=20 RATE=5

quick-500:
	@$(MAKE) test-custom WALLETS=500 DURATION=50 RATE=10

# Report generation
report:
	@if [ -z "$(FILE)" ]; then \
		LATEST_FILE=$$(ls -t results-*.json 2>/dev/null | head -1); \
		if [ -z "$$LATEST_FILE" ]; then \
			echo "$(RED)No result files found. Run a test first.$(NC)"; \
			exit 1; \
		fi; \
		echo "$(BLUE)Generating report from latest file: $$LATEST_FILE$(NC)"; \
		npx artillery report $$LATEST_FILE --output report-$$(date +%Y%m%d-%H%M%S).html; \
	else \
		echo "$(BLUE)Generating report from: $(FILE)$(NC)"; \
		npx artillery report $(FILE) --output report-$$(date +%Y%m%d-%H%M%S).html; \
	fi
	@echo "$(GREEN)HTML report generated!$(NC)"

# Open Artillery dashboard
dashboard:
	@echo "$(BLUE)Opening Artillery dashboard...$(NC)"
	@if command -v artillery >/dev/null 2>&1; then \
		echo "Run: artillery run <config> --ui"; \
		echo "Or install Artillery Pro: npm install -g @artilleryio/artillery-pro"; \
	else \
		echo "$(RED)Artillery not installed. Run: make install$(NC)"; \
	fi

# Setup Artillery Cloud
dashboard-setup:
	@echo "$(BLUE)Setting up Artillery Cloud...$(NC)"
	@echo "$(YELLOW)This will open a browser for login$(NC)"
	artillery auth:login

# Interactive test builder
interactive:
	@echo "$(CYAN)Interactive Test Builder$(NC)"
	@echo ""
	@read -p "Number of wallets: " wallets; \
	read -p "Test duration (seconds): " duration; \
	read -p "Wallets per second: " rate; \
	echo ""; \
	echo "$(YELLOW)Configuration:$(NC)"; \
	echo "  Wallets: $$wallets"; \
	echo "  Duration: $$duration seconds"; \
	echo "  Rate: $$rate wallets/second"; \
	echo "  Expected total: ~$$(echo "$$rate * $$duration" | bc) wallets"; \
	echo ""; \
	read -p "Continue? (y/N): " confirm; \
	if [ "$$confirm" = "y" ]; then \
		$(MAKE) test-custom WALLETS=$$wallets DURATION=$$duration RATE=$$rate; \
	fi

# Interactive cloud test
interactive-cloud:
	@echo "$(CYAN)Interactive Cloud Test Builder$(NC)"
	@echo ""
	@read -p "Number of wallets: " wallets; \
	read -p "Test duration (seconds): " duration; \
	read -p "Wallets per second: " rate; \
	read -p "Test name: " name; \
	echo ""; \
	echo "$(YELLOW)Configuration:$(NC)"; \
	echo "  Wallets: $$wallets"; \
	echo "  Duration: $$duration seconds"; \
	echo "  Rate: $$rate wallets/second"; \
	echo "  Name: $$name"; \
	echo "  Cloud: Enabled"; \
	echo ""; \
	read -p "Continue? (y/N): " confirm; \
	if [ "$$confirm" = "y" ]; then \
		$(MAKE) test-custom WALLETS=$$wallets DURATION=$$duration RATE=$$rate CLOUD=true NAME="$$name"; \
	fi

# Test with real-time dashboard
test-with-dashboard:
	@echo "$(GREEN)🧪 Running test with real-time dashboard...$(NC)"
	@$(MAKE) test-custom WALLETS=$(WALLETS) DURATION=$(DURATION) RATE=$(RATE) UI=true

# Modern dashboard commands
dashboard-start:
	@echo "$(BLUE)Artillery Dashboard Options:$(NC)"
	@echo ""
	@echo "$(YELLOW)1. Artillery Cloud:$(NC)"
	@echo "   Visit: https://app.artillery.io"
	@echo "   Login: make dashboard-setup"
	@echo ""
	@echo "$(YELLOW)2. Real-time UI:$(NC)"
	@echo "   Run: make test-custom UI=true"
	@echo ""
	@echo "$(YELLOW)3. Cloud + UI:$(NC)"
	@echo "   Run: make test-custom CLOUD=true UI=true"

monitor-test:
	@echo "$(BLUE)Monitoring options:$(NC)"
	@echo "1. Artillery Cloud dashboard: https://app.artillery.io"
	@echo "2. Real-time JSON output: tail -f results-*.json"
	@echo "3. System monitoring: htop, iotop, netstat"

# Clean up
clean:
	@echo "$(YELLOW)🧹 Cleaning up reports...$(NC)"
	rm -f results-*.json
	rm -f report-*.html
	rm -f temp-*.yml
	@echo "$(GREEN)Cleanup complete$(NC)"

# Show recent results
results:
	@echo "$(BLUE)Recent test results:$(NC)"
	@ls -la results-*.json 2>/dev/null | head -10 || echo "$(YELLOW)No results found$(NC)"

# Check configurations (basic syntax check)
check-configs:
	@echo "$(BLUE)Checking configurations...$(NC)"
	@for file in load-test/*.yml; do \
		echo "Checking $$file..."; \
		if [ -f "$$file" ]; then \
			echo "$(GREEN)$$file exists$(NC)"; \
		else \
			echo "$(RED)$$file missing$(NC)"; \
		fi; \
	done
	@echo "$(GREEN)Configuration check complete$(NC)"
