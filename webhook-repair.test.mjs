import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuggyReceiver, createRepairedReceiver } from './webhook-repair.mjs';

const event = (id = 'synthetic-event-1') => ({ id, payload: { task: 'synthetic-ticket' } });
const gate = () => {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
};

test('baseline reproduction: a transient failure permanently suppresses retry', async () => {
  let calls = 0;
  const receive = createBuggyReceiver(async () => {
    calls += 1;
    if (calls === 1) throw new Error('synthetic transient failure');
    return 'delivered-on-retry';
  });
  await assert.rejects(receive(event()), /transient/);
  assert.deepEqual(await receive(event()), { status: 'accepted', duplicate: true });
  assert.equal(calls, 1, 'The retry was incorrectly skipped; the baseline bug is reproduced');
});

test('baseline reproduction: a duplicate is accepted while original delivery is unresolved', async () => {
  const delivery = gate();
  const receive = createBuggyReceiver(() => delivery.promise);
  const first = receive(event());
  assert.deepEqual(await receive(event()), { status: 'accepted', duplicate: true });
  delivery.release('actual-delivery');
  assert.deepEqual(await first, { status: 'delivered', result: 'actual-delivery' });
});

test('repair: retry succeeds after transient failure, then replay does not redeliver', async () => {
  let calls = 0;
  const receive = createRepairedReceiver(async () => {
    calls += 1;
    if (calls === 1) throw new Error('synthetic transient failure');
    return 'delivered-on-retry';
  });
  await assert.rejects(receive(event()), /transient/);
  const expected = { status: 'delivered', result: 'delivered-on-retry' };
  assert.deepEqual(await receive(event()), expected);
  assert.deepEqual(await receive(event()), expected);
  assert.equal(calls, 2);
});

test('repair: overlapping duplicates wait for the same delivery and return its result', async () => {
  const delivery = gate();
  let calls = 0;
  const receive = createRepairedReceiver(async () => { calls += 1; return delivery.promise; });
  let duplicateSettled = false;
  const first = receive(event());
  const second = receive(event()).then(result => { duplicateSettled = true; return result; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(duplicateSettled, false, 'Duplicate must not acknowledge undelivered work');
  delivery.release('shared-result');
  assert.deepEqual(await Promise.all([first, second]), [
    { status: 'delivered', result: 'shared-result' },
    { status: 'delivered', result: 'shared-result' },
  ]);
});

test('repair: an overlapping failure reaches all callers; later retry is not suppressed', async () => {
  const delivery = gate();
  let calls = 0;
  const receive = createRepairedReceiver(async () => {
    calls += 1;
    if (calls === 1) { await delivery.promise; throw new Error('shared failure'); }
    return 'recovered';
  });
  const failed = Promise.allSettled([receive(event()), receive(event())]);
  delivery.release();
  const results = await failed;
  assert.deepEqual(results.map(result => result.status), ['rejected', 'rejected']);
  assert.equal(calls, 1);
  assert.deepEqual(await receive(event()), { status: 'delivered', result: 'recovered' });
  assert.equal(calls, 2);
});

test('repair: synchronous callback failure also releases the event for retry', async () => {
  let calls = 0;
  const receive = createRepairedReceiver(() => {
    calls += 1;
    if (calls === 1) throw new Error('synchronous failure');
    return 0;
  });
  await assert.rejects(receive(event()), /synchronous/);
  assert.deepEqual(await receive(event()), { status: 'delivered', result: 0 });
  assert.equal(calls, 2);
});

test('repair: separate identifiers remain independent', async () => {
  let calls = 0;
  const receive = createRepairedReceiver(() => ++calls);
  assert.deepEqual(await Promise.all([receive(event('A')), receive(event('B'))]), [
    { status: 'delivered', result: 1 },
    { status: 'delivered', result: 2 },
  ]);
});

test('repair: invalid identifiers never invoke delivery', async () => {
  let calls = 0;
  const receive = createRepairedReceiver(() => ++calls);
  for (const invalid of [undefined, {}, { id: 1 }, { id: '' }, { id: '  ' }]) {
    await assert.rejects(receive(invalid), /event.id/);
  }
  assert.equal(calls, 0);
});

test('repair: capacity includes pending events; completed replays remain available', async () => {
  const delivery = gate();
  const receive = createRepairedReceiver(() => delivery.promise, { maxEvents: 1 });
  const first = receive(event('A'));
  await assert.rejects(receive(event('B')), /capacity/);
  delivery.release('A-result');
  await first;
  await assert.rejects(receive(event('B')), /capacity/);
  assert.deepEqual(await receive(event('A')), { status: 'delivered', result: 'A-result' });
});

test('repair: failed delivery releases reserved capacity for another event', async () => {
  let calls = 0;
  const receive = createRepairedReceiver(() => {
    if (++calls === 1) throw new Error('failure');
    return 'B-result';
  }, { maxEvents: 1 });
  await assert.rejects(receive(event('A')), /failure/);
  assert.deepEqual(await receive(event('B')), { status: 'delivered', result: 'B-result' });
});
