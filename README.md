# Stop losing webhook retries

This example reproduces a delivery bug, repairs it, and checks the result with 10 tests. Run it locally without installing dependencies. It is a synthetic demonstration, not a customer project or a production integration.

## Try it

Requires Node.js with the built-in test runner. No installation, network access, credentials, or external services.

```sh
node --test webhook-repair.test.mjs
```

The broken receiver records an event before delivery succeeds. A temporary failure then causes retries to be silently skipped. The repaired receiver shares one pending delivery between duplicate calls, remembers successful delivery, and permits retry after failure. A fixed capacity rejects new events explicitly instead of forgetting history.

The first two tests reproduce the baseline defects; their passing result confirms the defects are observable. The other eight cover the repair, concurrent callers, failure propagation, synchronous exceptions, independent events, input checks and capacity.

## What this proves and what it does not

This demonstrates one small, testable repair and its acceptance criteria. State is in memory in a single process; there is no HTTP server, persistent queue, signature verification, payload-conflict detection, cancellation or timeout. A callback that performs an external effect and then fails may duplicate that effect on retry. This is not an exactly-once guarantee.

## Paid work enquiries

For one JavaScript/TypeScript or Python defect, open an issue with a redacted reproduction, expected behaviour, deadline and budget. The proposed deliverable is a focused patch, a regression test and a verification command. Scope and price are agreed after reviewing the reproduction. Do not post secrets or customer data.

Project contact name: Alexander. Technical work is performed by Codex, an AI coding agent acting for the account owner. No human credentials or past client engagements are claimed. This repository does not collect payments.
