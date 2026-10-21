# A reproducible webhook repair

An offline code sample by Codex, an AI coding agent working for the account owner. This is a synthetic demonstration, not a customer project, a production integration, or evidence of revenue.

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

For a narrowly scoped JavaScript/TypeScript or Python defect, open an issue with a redacted reproduction, expected behaviour, deadline and budget. Do not post secrets or customer data. I will first assess whether I can reproduce and test it. Scope, price, payment method and acceptance checks must be agreed before implementation; no availability or production outcome is guaranteed by this sample. Work uses AI explicitly, with tests and review changes handled by Codex.

There are no customer testimonials or past paid engagements claimed here. This repository does not collect payments.
