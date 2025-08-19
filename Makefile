# DIDComm Mediator Load Testing Makefile
# Usage examples:
#   make test-basic
#   make test-custom WALLETS=500 DURATION=60 RATE=10

# Default values
WALLETS ?= 100
DURATION ?= 30
RATE ?= 5
TARGET ?= https://qa-mediator.ngotag.com

# Node.js options handled in wrapper (run-artillery.sh)
NODE_OPTS :=

# Colors for output
RED    = \033[0;31m
GREEN  = \033[0;32m
YELLOW = \033[0;33m
BLUE   = \033[0;34m
CYAN   = \033[0;36m
NC     = \033[0m # No Color

.PHONY: help install test-basic test-custom report clean check-mediator

# Default target
help:
	@echo "$(CYAN)DIDComm Mediator Load Testing$(NC)"
	@echo ""
	@echo "$(YELLOW)Available Tests:$(NC)"
	@echo "  make test-basic                    - Run basic test (predefined phases)"
	@echo "  make test-custom                   - Run custom test with parameters"
	@echo ""
	@echo "$(YELLOW)Custom Test Parameters:$(NC)"
	@echo "  WALLETS=N                          - Number of wallets (default: 100)"
	@echo "  DURATION=N                         - Test duration in seconds (default: 30)"
	@echo "  RATE=N                             - Wallets per second (default: 5)"
	@echo ""
	@echo "$(YELLOW)Utilities:$(NC)"
	@echo "  make install                       - Install dependencies"
	@echo "  make clean                         - Clean up reports"
	@echo "  make check-mediator               - Check if mediator is responding"
	@echo "  make report                        - Generate HTML report from last run"
	@echo ""
	@echo "$(YELLOW)Examples:$(NC)"
	@echo "  make test-custom WALLETS=250 DURATION=45 RATE=8"
	@echo "  make test-custom WALLETS=50 DURATION=20 RATE=3"

# Install dependencies
install:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install

# Check if mediator is responding
check-mediator:
	@echo "$(BLUE)Checking mediator status...$(NC)"
	@curl -I $(TARGET) 2>/dev/null | head -1 || echo "$(RED)Mediator not responding$(NC)"

# Basic predefined test - using wrapper script
test-basic:
	@echo "$(GREEN)Running basic test (predefined phases)...$(NC)"
	./run-artillery.sh run tests/basic.yml --output results-basic-$(shell date +%Y%m%d-%H%M%S).json

# Custom test with user parameters
test-custom:
	@echo "$(GREEN)Running custom test...$(NC)"
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
	./run-artillery.sh run temp-config.yml --output $$OUTPUT_FILE && \
	rm temp-config.yml && \
	echo "$(GREEN)Test completed! Report saved to: $$OUTPUT_FILE$(NC)" && \
	echo "$(CYAN)Generate HTML report: make report FILE=$$OUTPUT_FILE$(NC)"

# Report generation
report:
	@if [ -z "$(FILE)" ]; then \
		LATEST_FILE=$$(ls -t results-*.json 2>/dev/null | head -1); \
		if [ -z "$$LATEST_FILE" ]; then \
			echo "$(RED)No result files found. Run a test first.$(NC)"; \
			exit 1; \
		fi; \
		./run-artillery.sh report $$LATEST_FILE --output report-$$(date +%Y%m%d-%H%M%S).html; \
	else \
		./run-artillery.sh report $(FILE) --output report-$$(date +%Y%m%d-%H%M%S).html; \
	fi
	@echo "$(GREEN)HTML report generated!$(NC)"

# Clean up
clean:
	@echo "$(YELLOW)Cleaning up reports...$(NC)"
	rm -f results-*.json
	rm -f report-*.html
	rm -f temp-*.yml
	@echo "$(GREEN)Cleanup complete$(NC)"
