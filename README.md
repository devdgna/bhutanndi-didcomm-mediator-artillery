# DIDComm Mediator Load Testing (Minimal Harness)

A lean Artillery + Credo-TS harness to exercise a DIDComm mediator with real agent workflows (invitation -> connection -> mediation -> pickup) while keeping the runtime deterministic and lightweight.

## Key Features
- Minimal file set (Makefile, wrapper, processor, basic scenario)
- Deterministic dependency versions (no implicit feature creep)
- Preload shim normalizes `fetch` (avoids historical `URLSearchParams` / `node-fetch` mismatch)
- Custom arrival rate & duration via `make test-custom`
- Built‑in custom metrics (connection, mediation, pickup)

## Repository Layout
```
Makefile              # Test targets & dynamic custom scenario generation
run-artillery.sh      # Wrapper that injects preload & runtime flags
preload-fetch.js      # Undici-based fetch shim + node-fetch interception
tests/basic.yml       # Example phased scenario
tests/processor.js    # Virtual user logic (Credo agent lifecycle)
```

## Prerequisites
- Node.js 20+ (recommend 22 LTS for latest undici)
- `make`, `bash`, `curl` (optional for health check)

## Install
```bash
npm install
```

## Environment
Create `.env` (only one variable strictly required):
```bash
INVITATION_URL=https://your-mediator.example.com/invitation?oob=...  # required
# DID_METHOD=key   # currently only `did:key` flow kept; other methods optional (see Extending)
```

## Run Tests
Basic (uses `tests/basic.yml` phases):
```bash
make test-basic
```
Custom (single phase generated on the fly):
```bash
make test-custom WALLETS=50 DURATION=30 RATE=2
```
Parameters:
- `WALLETS` (informational label in report; actual concurrency is arrival pattern) 
- `DURATION` seconds of the single phase
- `RATE` virtual wallets per second (Artillery `arrivalRate`)

Example higher load:
```bash
make test-custom WALLETS=300 DURATION=60 RATE=10
```

## Make Targets
| Target | Description |
|--------|-------------|
| `make install` | Install dependencies |
| `make test-basic` | Run predefined multi‑phase scenario |
| `make test-custom WALLETS=.. DURATION=.. RATE=..` | Generate & run one-phase scenario |
| `make report [FILE=results-*.json]` | Produce HTML report from JSON |
| `make check-mediator` | HEAD request to target (quick reachability) |
| `make clean` | Remove result/report/temp files |

Result JSON filenames: `results-basic-<timestamp>.json` or `results-custom-<params>-<timestamp>.json`

## Processor Flow & Metrics
Each VU performs:
1. Parse invitation (OOB) & create agent
2. Establish connection & wait for completed state
3. Send mediation request; await grant
4. Execute message pickup (Pickup V2) once
5. Shutdown agent cleanly

Emitted metrics (names you can add thresholds for):
- `didcomm.connection.duration` (histogram)
- `didcomm.mediation.success` / `didcomm.mediation.failed` (counters)
- `didcomm.pickup.duration` (histogram)
- `didcomm.pickup.messages` (counter)

Sample thresholds block (add inside a YAML config if you extend scenarios):
```yaml
config:
  ensure:
    thresholds:
      - 'didcomm.connection.duration': { p95: 5000 }
      - 'vusers.failed': { max: 0 }
```

## Fetch Shim (Why `preload-fetch.js` Exists)
A past issue arose from a transitive dependency mixing `node-fetch@2` / `ky-universal` with native WHATWG classes, causing `TypeError [ERR_INVALID_THIS]: Value of 'this' must be of type URLSearchParams` under load.

The wrapper (`run-artillery.sh`) always starts Node with:
- `--require preload-fetch.js` (before Artillery workers spawn)
- `--no-warnings` & DNS ordering flag

`preload-fetch.js`:
- Provides undici globals (`fetch`, `Headers`, `Request`, `Response`)
- Intercepts any `require('node-fetch')` and returns an undici-backed shim
- Patches `URLSearchParams` safe methods to prevent detached calls
Result: Stable, uniform fetch stack across all worker processes.

Always launch tests via `make` (or `./run-artillery.sh`) so the preload runs. Running `npx artillery` directly bypasses the shim and may reintroduce the error.

## Extending (Optional DID Methods)
Currently only `did:key` flows are active. To experiment with other DID methods:
1. Add needed dependencies (e.g. cheqd / ethr packages) carefully.
2. Verify they do not bundle an outdated `node-fetch` without interception (the preload should still catch them, but validate).
3. Set `DID_METHOD=ethr` (or another) in environment prior to running.

If adding Ethereum-based methods you may also need:
```bash
export ETHEREUM_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/your-key
export ETHEREUM_NETWORK=polygon:mumbai
```
Keep changes isolated; optional features can inflate the dependency tree and slow cold starts.

## Reports
Generate HTML from latest result:
```bash
make report
```
From a specific file:
```bash
make report FILE=results-custom-300w-20250801-121500.json
```
HTML file name: `report-<timestamp>.html`.

## Troubleshooting
| Symptom | Fix |
|---------|-----|
| `INVITATION_URL` not set error / immediate failures | Provide valid OOB invitation in `.env` |
| `ERR_INVALID_THIS` appears again | Ensure you used `make` / wrapper; delete `node_modules` & reinstall |
| Native `askar` build issues | Use supported Node version (LTS), reinstall dependencies |
| High memory with large RATE | Lower `RATE` or split into multiple runs |
| Long connection times | Check mediator health / network latency |

Reset environment:
```bash
rm -rf node_modules package-lock.json && npm install
```

## License
ISC (see `package.json`).

## Contributing
Lightweight contribution flow:
1. Fork & branch
2. Make change (keep scope minimal)
3. `make test-basic` sanity run
4. PR with summary & rationale for any new dependency

---
Happy testing.
