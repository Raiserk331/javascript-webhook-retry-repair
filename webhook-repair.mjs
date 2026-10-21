/** Synthetic, offline repair fixture. Never connected to a customer service. */
export function createBuggyReceiver(deliver) {
  const seen = new Set();
  return async function receive(event) {
    if (seen.has(event.id)) return { status: 'accepted', duplicate: true };
    // BUG: recording acceptance before delivery loses transient failures.
    seen.add(event.id);
    const result = await deliver(event.payload);
    return { status: 'delivered', result };
  };
}

/**
 * Deduplicate successful events and share an outstanding delivery.
 * Contract: event.id is a stable identifier for one immutable event.
 * This demonstrates one process lifetime, not durable exactly-once delivery.
 */
export function createRepairedReceiver(deliver, { maxEvents = 1000 } = {}) {
  if (typeof deliver !== 'function') throw new TypeError('deliver must be a function');
  if (!Number.isInteger(maxEvents) || maxEvents < 1) {
    throw new TypeError('maxEvents must be a positive integer');
  }
  const completed = new Map();
  const inFlight = new Map();

  return async function receive(event) {
    if (!event || typeof event.id !== 'string' || event.id.trim().length === 0) {
      throw new TypeError('event.id must be a non-empty string');
    }
    const id = event.id;
    if (completed.has(id)) return completed.get(id);
    if (inFlight.has(id)) return inFlight.get(id);
    if (completed.size + inFlight.size >= maxEvents) {
      throw new Error('Event capacity reached; reconcile before accepting new events');
    }

    // Queue the callback in a microtask: the shared promise is registered first,
    // even when deliver throws synchronously or returns immediately.
    const pending = Promise.resolve()
      .then(() => deliver(event.payload))
      .then(result => {
        const response = { status: 'delivered', result };
        completed.set(id, response);
        return response;
      })
      .finally(() => inFlight.delete(id));
    inFlight.set(id, pending);
    return pending;
  };
}
