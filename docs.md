# Dashboard & Reporting Guide (Minimal Harness)

This project focuses on a lean setup. Advanced/cloud features are optional; below are practical ways to view and analyze results with the current minimal files.

## Local JSON & HTML Reports

Basic run produces a JSON stats file:
```bash
make test-basic
# => results-basic-<timestamp>.json
```
Custom run:
```bash
make test-custom WALLETS=100 DURATION=45 RATE=6
# => results-custom-100w-<timestamp>.json
```
Generate HTML:
```bash
make report                      # latest
make report FILE=results-custom-100w-20250801-120000.json
```

## Metrics Emitted
From `tests/processor.js`:
- Histogram: `didcomm.connection.duration`
- Counter: `didcomm.mediation.success` / `didcomm.mediation.failed`
- Histogram: `didcomm.pickup.duration`
- Counter: `didcomm.pickup.messages`

Add thresholds (when you author extended YAML scenarios):
```yaml
config:
  ensure:
    thresholds:
      - 'didcomm.connection.duration': { p95: 5000 }
      - 'vusers.failed': { max: 0 }
```

## Real-Time Watching (Simple)
Tail JSON output during a run (basic approximation):
```bash
jq -r '.intermediate // empty | .latency || empty' results-basic-*.json
```
(Artillery writes final JSON at end; for continuous view consider piping stdout with a future custom reporter.)

## Optional Cloud (If You Re-Enable)
If you later install Artillery Cloud/Pro packages you can run with `--record` flags, but this minimal harness intentionally omits them to reduce dependencies. Example (after installing globally):
```bash
./run-artillery.sh run tests/basic.yml --record --name "Mediator Basic"
```
Ensure you still use the wrapper so the preload fetch shim is active.

## Preload Reminder
All runs MUST go through `run-artillery.sh` (or `make` targets) to guarantee the undici fetch shim & node-fetch interception are active, preventing historical `URLSearchParams` errors.

## Interpreting Key Metrics
| Metric | Meaning | Action if Degraded |
|--------|---------|--------------------|
| `didcomm.connection.duration` p95 | Time to complete connection | Investigate mediator load / network latency |
| `didcomm.mediation.success` vs failed | Mediation grant reliability | Enable mediator debug logs; inspect denied reasons |
| `didcomm.pickup.duration` | Pickup protocol latency | Check queue depth or mediator pickup handler performance |
| `didcomm.pickup.messages` | Messages retrieved count | Validate test data generation or mediator routing |

## Scaling Strategy (Manual)
Increase `RATE` gradually; observe p95 connection + mediation success counters. If failures rise:
1. Lower arrival rate
2. Increase mediator resources
3. Split into multiple sequential runs

## Troubleshooting Quick Table
| Issue | Resolution |
|-------|------------|
| `ERR_INVALID_THIS` resurfaces | Ensure wrapper used; reinstall deps |
| Zero successes | Verify `INVITATION_URL` validity & mediator online |
| Native module build error | Use Node 20/22 LTS; clear `node_modules` |
| Extremely long durations | Network / mediator underprovisioned |

## Future Extensions (Optional)
- Custom reporters streaming intermediate stats
- Threshold enforcement in generated custom YAML
- Integration with external monitoring (push counters to TSDB)

Keep docs lean; remove sections if features are not adopted to avoid drift.
