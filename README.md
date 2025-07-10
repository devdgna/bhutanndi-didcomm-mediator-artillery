# DIDComm Mediator Load Testing with Artillery

A comprehensive load testing suite for DIDComm mediators using Artillery and Credo-TS. This repository provides automated testing scenarios to validate mediator performance, scalability, and protocol compliance.

## Quick Start

```bash
# Install dependencies
npm install

# Run basic test (10 wallets)
make test-basic

# Run custom test
make test-custom WALLETS=50 DURATION=30 RATE=2

# Generate HTML report
make report FILE=results-basic-*.json
```

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd ngotag-artillery
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your mediator invitation URL and DID method
   ```

3. **Run basic test**:
   ```bash
   make test-basic
   ```

## Prerequisites

- **Node.js 18+** (required for Credo-TS and Artillery)
- **Git** for cloning the repository
- **Make** for running test commands
- **curl** for health checks (optional)

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Mediator invitation URL (required)
INVITATION_URL=https://your-mediator.example.com/invitation?oob=...

# DID method (optional, default: ethr)
DID_METHOD=ethr  # Options: ethr, key, sov

# Ethereum/Polygon RPC (for did:ethr only)
ETHEREUM_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/your-api-key
ETHEREUM_NETWORK=polygon:mumbai
```

### DID Method Options

- **`ethr`**: Ethereum/Polygon DIDs (requires RPC endpoint)
- **`key`**: Simple key-based DIDs (no external dependencies)
- **`sov`**: Sovrin-style DIDs (legacy support)

## Test Scenarios
- TODO

### Basic Tests
```bash
make test-basic          # 10 wallets, quick validation
make test-medium         # 100 wallets, moderate load
make test-large          # 500 wallets, high load
```

### Custom Tests
```bash
# Custom wallet count
make test-custom WALLETS=250

# Custom rate and duration
make test-custom WALLETS=100 DURATION=60 RATE=3

# Ramp test (gradual increase)
make test-ramp START=2 END=10 DURATION=120
```

### Stress Tests
```bash
make test-burst          # 500 wallets in 10 seconds
make test-sustained      # 6000 wallets over 5 minutes
make stress-test         # Maximum load (15,000+ wallets)
```

## What Gets Tested

Each virtual wallet performs:

1. **Endpoint Health Check** - Validates mediator is responding
2. **DID Exchange** - Establishes connection with mediator
3. **Mediation Request** - Requests mediation services
4. **Message Pickup** - Tests message retrieval
5. **Protocol Validation** - Verifies DIDComm v1 and Pickup v2 compliance

## Configuration

### Default Settings
- **Target**: `https://animo-mediator-qa.ngotag.com` (change with `TARGET=`)
- **Wallet Count**: 100 (change with `WALLETS=`)
- **Duration**: 30 seconds (change with `DURATION=`)
- **Rate**: 5 wallets/second (change with `RATE=`)

### Environment Variables
```bash
# Target mediator endpoint
export TARGET=https://your-mediator.example.com

# Test parameters
export WALLETS=250
export DURATION=45
export RATE=8
```

## DID Method Configuration

This load testing suite supports multiple DID methods:

### Supported DID Methods
- **`did:ethr`** - Ethereum/Polygon DIDs (default)
- **`did:key`** - Self-contained cryptographic DIDs  
- **`did:sov`** - Sovrin/Indy ledger DIDs

### Environment Variables
```bash
# Set DID method (ethr, key, or sov)
export DID_METHOD=ethr

# For did:ethr - Polygon network configuration
export ETHEREUM_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/your-key
export ETHEREUM_NETWORK=polygon:mumbai

# Test parameters
export WALLETS=250
export DURATION=45
export RATE=8
```

### Usage Examples
```bash
# Test with did:ethr on Polygon Mumbai
DID_METHOD=ethr make test-custom WALLETS=50

# Test with did:key (fastest, no blockchain)
DID_METHOD=key make test-basic

# Test with did:sov (Indy ledger)
DID_METHOD=sov make test-custom WALLETS=100
```

## Reports and Monitoring

### Generate Reports
```bash
# HTML report from latest test
make report

# Report from specific file
make report FILE=results-custom-250w-20250710-123456.json

# Open Artillery dashboard
make dashboard
```

### Cloud Integration
```bash
# Run with Artillery Cloud reporting
make test-custom CLOUD=true

# Setup cloud credentials
make dashboard-setup
```

## Repository Structure

```
├── tests/
│   ├── processor.js           # DIDComm agent logic (Credo-TS)
│   ├── basic.yml             # Basic mediation test scenario
│   ├── burst.yml             # High-load burst scenario
│   ├── sustained.yml         # Long-duration scenario
│   └── stress.yml            # Maximum load scenario
├── Makefile                  # Test automation and utilities
├── package.json             # Dependencies (Artillery + Credo-TS)
├── README.md                # This documentation
└── docs.md                  # Detailed Artillery guide
```

## Development

### Dependencies
- **Artillery 2.0+** - Load testing framework
- **Credo-TS 0.5+** - DIDComm agent implementation
- **Askar** - Secure storage for credentials

### Key Features
- **Real DIDComm Testing** - Uses actual Credo-TS agents
- **Protocol Compliance** - Tests DIDComm v1 and Pickup v2
- **Scalable Architecture** - Handles 15,000+ concurrent wallets
- **Comprehensive Reporting** - Detailed metrics and HTML reports
- **Cloud Integration** - Artillery Cloud support
- **Automation Ready** - Makefile-based workflows

### Troubleshooting

**No logs on mediator?**
- Ensure you're using `load-test/mediation.yml` or `processor.js`
- Check that Credo-TS dependencies are installed
- Verify mediator endpoint is accessible

**High memory usage?**
- Reduce `WALLETS` or `RATE` parameters
- Use `test-basic` for initial validation
- Monitor with `make report` after tests

**Dependency conflicts?**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` to reinstall clean dependencies
- Use Node.js 18+ for best compatibility

## Examples

### Scale Testing
```bash
# Progressive scale testing
make test-custom WALLETS=10    # Baseline
make test-custom WALLETS=50    # Small scale
make test-custom WALLETS=100   # Medium scale
make test-custom WALLETS=500   # Large scale
```

### Performance Benchmarking
```bash
# Different rates with same total
make test-custom WALLETS=100 DURATION=50 RATE=2   # Slow and steady
make test-custom WALLETS=100 DURATION=20 RATE=5   # Medium pace
make test-custom WALLETS=100 DURATION=10 RATE=10  # Fast burst
```

### Endurance Testing
```bash
# Long-running tests
make test-sustained                                # 5 minutes
make test-custom DURATION=300 RATE=3              # Custom endurance
```

## License

ISC License - see package.json for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feat/feat-1`)
3. Test your changes (`make test-basic`)
4. Commit your changes (`git commit -m 'feat: some feats`)
5. Push to branch (`git push origin feature/feat-1`)
6. Open a Pull Request

---

# Stress testing
make stress-test

# View recent results
make results

# Clean up
make clean
```

## Architecture

- **Artillery**: Load testing framework
- **Credo-TS**: DIDComm agent implementation
- **Askar**: Secure storage for wallets
- **Mediator**: Animo DIDComm mediator (QA environment)

## Structure

```
├── Makefile                     # Main automation commands
├── package.json                 # Dependencies and scripts
├── MODERN_ARTILLERY_GUIDE.md    # Complete documentation
└── load-test/
    ├── processor.js             # Agent logic and scenarios
    ├── mediation.yml            # Basic mediation test
    ├── burst-test.yml           # Burst load scenario
    ├── sustained-test.yml       # Long duration scenario
    └── stress-test.yml          # Maximum load scenario
```

## Requirements

- Node.js 18+
- Artillery CLI
- Make (for automation)
- bc (for calculations)

## Performance

Recent test results show:
- **100% connection success** rate for moderate loads
- **5-25 second** end-to-end timing for mediation setup
- **Successful message pickup** using Pickup v2 protocol
- **Scales to 500+ concurrent** wallet connections

---

Built for testing Animo DIDComm mediator at https://animo-mediator-qa.ngotag.com
