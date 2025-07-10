# Modern Artillery Dashboard & Reporting Guide

## Artillery Cloud Dashboard (Free Tier)

### 1. Setup Artillery Cloud Account
```bash
# Login to Artillery Cloud (free account)
artillery auth:login

# Alternative: Use with API key
export ARTILLERY_CLOUD_API_KEY="your_api_key_here"
```

### 2. Run Tests with Cloud Reporting
```bash
# Basic cloud reporting
artillery run load-test/mediation.yml --record

# With custom test name and tags
artillery run load-test/mediation.yml --record \
  --name "DIDComm Mediator Load Test" \
  --tags "environment:qa,service:mediator,version:1.0"

# Custom test using Makefile with cloud
make test-custom WALLETS=100 DURATION=60 RATE=5 CLOUD=true
```

### 3. View Results
- Visit: https://app.artillery.io
- View real-time metrics, charts, and detailed analytics
- Share reports with team members
- Set up alerts and monitoring

## Real-Time Dashboard (Local)

### 1. Install Artillery Pro (Free Features)
```bash
# Install Artillery Pro for additional features
npm install -g @artilleryio/artillery-pro

# Or use with existing installation
npx @artilleryio/artillery-pro
```

### 2. Run with Live Dashboard
```bash
# Launch with real-time web UI
artillery run load-test/mediation.yml --ui

# Custom port for dashboard
artillery run load-test/mediation.yml --ui --port 8080

# With cloud recording + UI
artillery run load-test/mediation.yml --ui --record
```

## Custom Metrics & Advanced Reporting

### Enhanced Processor for Better Metrics
Our `processor.js` already includes comprehensive logging. Here are the key metrics tracked:

```javascript
// Connection timing
events.emit('histogram', 'didcomm.connection.duration', connectionTime);

// Mediation success rate
events.emit('counter', 'didcomm.mediation.success', 1);
events.emit('counter', 'didcomm.mediation.failed', 1);

// Message pickup metrics
events.emit('histogram', 'didcomm.pickup.duration', pickupTime);
events.emit('counter', 'didcomm.pickup.messages', messageCount);
```

### View Metrics in Dashboard
- **Connection Rate**: How fast wallets connect
- **Mediation Success**: Percentage of successful mediations
- **Message Pickup**: Pickup protocol performance
- **Error Rates**: Failed connections/mediations
- **Response Times**: End-to-end timing

## Makefile Integration with Cloud

### Updated Makefile Commands
```bash
# Run with cloud reporting
make test-custom WALLETS=200 DURATION=30 RATE=10 CLOUD=true

# Stress test with detailed reporting
make stress-test CLOUD=true NAME="Stress Test v1.0"

# Interactive test with cloud
make interactive-cloud
```

## Analysis & Monitoring

### Key Metrics to Monitor

1. **Connection Success Rate**: Should be >95%
2. **Mediation Latency**: Target <500ms per mediation
3. **Message Pickup Rate**: Messages retrieved successfully
4. **Resource Usage**: CPU/Memory on mediator
5. **Error Patterns**: Timeout vs protocol errors

### Scaling Thresholds
```yaml
# Add to your test configs
config:
  ensure:
    thresholds:
      - 'didcomm.connection.duration': 
          median: 2000  # 2 seconds max
          p95: 5000     # 5 seconds 95th percentile
      - 'didcomm.mediation.success_rate':
          min: 0.95     # 95% success rate minimum
      - 'vusers.failed_rate':
          max: 0.05     # Max 5% failed users
```

## Local HTML Reports (Alternative)

If you need local HTML reports, use:

```bash
# Generate JSON first
artillery run load-test/mediation.yml --output results.json

# Use third-party tools for HTML conversion
npm install -g artillery-report-html
artillery-report-html results.json report.html

# Or use Artillery Pro features
npx @artilleryio/artillery-pro report results.json
```

## Interactive Dashboard Commands

### Quick Dashboard Access
```bash
# Start a quick monitoring dashboard
make dashboard-start

# View live metrics during test
make test-with-dashboard WALLETS=50

# Monitor ongoing test
make monitor-test
```

### Real-Time Monitoring
```bash
# Terminal-based real-time metrics
artillery run load-test/mediation.yml --output /dev/stdout | jq '.stats'

# With live updates
watch -n 5 'tail -10 /var/log/artillery.log'
```

## Alerts & Notifications

### Set Up Alerts (Artillery Cloud)
1. Go to https://app.artillery.io
2. Navigate to your test
3. Set up alerts for:
   - High error rates (>5%)
   - Slow response times (>2s median)
   - Low success rates (<95%)

### Webhook Integration
```yaml
config:
  plugins:
    webhooks:
      url: "https://hooks.slack.com/your-webhook"
      channels: ["#load-testing"]
```

## Mobile & Team Collaboration

### Share Results
- **Artillery Cloud**: Shareable URLs for reports
- **Team Dashboards**: Real-time collaboration
- **Export Options**: PDF, CSV, JSON formats
- **API Access**: Programmatic result retrieval

### Integration Examples
```bash
# CI/CD Integration
artillery run test.yml --record --name "CI Build #${BUILD_NUMBER}"

# Automated reporting
artillery run test.yml --output results.json
./scripts/process-results.sh results.json

# Performance regression testing
artillery run test.yml --threshold "p95<2000"
```

## Best Practices

1. **Always use `--record` for important tests**
2. **Tag tests with environment and version info**
3. **Set meaningful test names for tracking**
4. **Monitor trends over time, not just individual runs**
5. **Use thresholds to catch performance regressions**
6. **Share dashboard access with team members**

## Useful Links

- Artillery Cloud: https://app.artillery.io
- Documentation: https://artillery.io/docs
- Pro Features: https://artillery.io/pro
- Community: https://github.com/artilleryio/artillery

## DID Method Support

The processor now supports multiple DID methods:

### `did:ethr` (Ethereum/Polygon)
- **Network**: Polygon Mumbai testnet (free)
- **Benefits**: Blockchain-anchored DIDs, compatible with Ethereum ecosystem
- **Use case**: Testing with verifiable, blockchain-registered identities
- **Configuration**: Set `DID_METHOD=ethr` environment variable

### `did:key` (Self-contained)
- **Network**: None (cryptographic only)
- **Benefits**: Fastest generation, no network dependencies
- **Use case**: High-volume testing, offline scenarios
- **Configuration**: Set `DID_METHOD=key` environment variable

### `did:sov` (Sovrin/Indy)
- **Network**: Sovrin ledger
- **Benefits**: Enterprise identity, privacy-preserving credentials
- **Use case**: Testing Hyperledger Aries compatibility
- **Configuration**: Set `DID_METHOD=sov` environment variable

### Performance Comparison

| DID Method | Generation Speed | Network Dependency | Blockchain Anchored |
|------------|------------------|-------------------|-------------------|
| `did:key`  | Fastest         | None              | No                |
| `did:ethr` | Medium          | Polygon RPC       | Yes (Polygon)     |
| `did:sov`  | Slower          | Sovrin ledger     | Yes (Indy)        |
