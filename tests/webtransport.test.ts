// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrame, FrameDecoder, MAX_CONTROL_BYTES } from '../shared/framing.js';
import { WebTransportTransport, type TransportFactory } from '../client/transport.js';
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
function fake() {
  let control!: ReadableStreamDefaultController<Uint8Array>,
    incoming!: ReadableStreamDefaultController<ReadableStream<Uint8Array>>;
  const writes: Uint8Array[] = [];
  let close!: () => void;
  const transport = {
    ready: Promise.resolve(),
    closed: new Promise<void>((resolve) => {
      close = resolve;
    }),
    createBidirectionalStream: () =>
      Promise.resolve({
        readable: new ReadableStream<Uint8Array>({
          start(c) {
            control = c;
          },
        }),
        writable: new WritableStream<Uint8Array>({
          write(bytes) {
            writes.push(bytes);
          },
        }),
      }),
    incomingUnidirectionalStreams: new ReadableStream<ReadableStream<Uint8Array>>({
      start(c) {
        incoming = c;
      },
    }),
    close: () => close(),
  };
  const factory: TransportFactory = () => transport;
  const snapshot = (now: number) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encodeFrame(JSON.stringify({ type: 'snapshot', now })));
        c.close();
      },
    });
  return {
    factory,
    writes,
    transport,
    send: (text: string) => control.enqueue(encodeFrame(text)),
    snapshot: (now: number) => incoming.enqueue(snapshot(now)),
    end: () => close(),
  };
}
void test('framing supports split headers, multibyte UTF-8 and coalesced messages', () => {
  const texts = ['{"name":"Куба 🐈"}', '{"seq":2}'],
    bytes = Buffer.concat(texts.map((t) => encodeFrame(t)));
  for (let split = 1; split < bytes.length; split++) {
    const decoder = new FrameDecoder();
    const actual = [
      ...decoder.push(bytes.subarray(0, split)),
      ...decoder.push(bytes.subarray(split)),
    ];
    decoder.finish();
    assert.deepEqual(actual, texts);
  }
  const d = new FrameDecoder(),
    all: string[] = [];
  for (const byte of bytes) all.push(...d.push(new Uint8Array([byte])));
  d.finish();
  assert.deepEqual(all, texts);
});
void test('framing rejects oversized, empty, truncated and invalid UTF-8 packets', () => {
  assert.throws(() => encodeFrame(''));
  assert.throws(() => encodeFrame('x'.repeat(MAX_CONTROL_BYTES + 1)));
  for (const bytes of [
    new Uint8Array([0, 0, 0, 0]),
    new Uint8Array([255, 255, 255, 255]),
    new Uint8Array([0, 0, 0, 1, 255]),
  ])
    assert.throws(() => new FrameDecoder().push(bytes));
  const d = new FrameDecoder();
  d.push(new Uint8Array([0, 0, 0, 2, 65]));
  assert.throws(() => d.finish());
});
void test('control and movement messages preserve reliable ordering', async () => {
  const f = fake(),
    received: string[] = [];
  const t = new WebTransportTransport(
    { url: 'https://localhost:4433/echo', protocolVersion: 3 },
    f.factory,
  );
  await t.connect(
    '',
    (v) => received.push(v.type),
    () => {},
  );
  t.sendReliable('{"type":"join"}');
  t.sendLatest('{"seq":1}');
  t.sendLatest('{"seq":2}');
  await tick();
  const d = new FrameDecoder();
  assert.deepEqual(
    f.writes.flatMap((b) => d.push(b)),
    ['{"type":"join"}', '{"seq":1}', '{"seq":2}'],
  );
  f.send('{"type":"welcome","id":"p","room":"ABC","protocolVersion":3}');
  await tick();
  assert.deepEqual(received, ['welcome']);
  assert.equal(t.bufferedAmount, 0);
  t.close();
});
void test('out-of-order and duplicate snapshot streams cannot move the world backwards', async () => {
  const f = fake(),
    received: number[] = [];
  const t = new WebTransportTransport(
    { url: 'https://localhost:4433/echo', protocolVersion: 3 },
    f.factory,
  );
  await t.connect(
    '',
    (v) => {
      if (v.type === 'snapshot') received.push(v.now);
    },
    () => {},
  );
  f.snapshot(300);
  f.snapshot(100);
  f.snapshot(300);
  f.snapshot(400);
  await tick();
  assert.deepEqual(received, [300, 400]);
  t.close();
});
void test('close fires failure once, explicit close does not report a lost connection', async () => {
  const f = fake();
  let failures = 0;
  const t = new WebTransportTransport(
    { url: 'https://localhost:4433/echo', protocolVersion: 3 },
    f.factory,
  );
  await t.connect(
    '',
    () => {},
    () => failures++,
  );
  f.end();
  await tick();
  assert.equal(failures, 1);
  assert.equal(t.sendLatest('{}'), false);
  t.close();
  await tick();
  assert.equal(failures, 1);
  const g = fake(),
    u = new WebTransportTransport(
      { url: 'https://localhost:4433/echo', protocolVersion: 3 },
      g.factory,
    );
  await u.connect(
    '',
    () => {},
    () => failures++,
  );
  u.close();
  await tick();
  assert.equal(failures, 1);
});
void test('transport rejects downgrade URLs, malformed fingerprints and old versions', async () => {
  for (const config of [
    { url: 'http://localhost/echo', protocolVersion: 3 },
    { url: 'https://localhost/echo', protocolVersion: 2 },
    { url: 'https://localhost/echo', protocolVersion: 3, certificateHashes: [[1, 2, 3]] },
  ]) {
    let created = false;
    const t = new WebTransportTransport(config, () => {
      created = true;
      throw Error('unexpected');
    });
    await assert.rejects(
      t.connect(
        '',
        () => {},
        () => {},
      ),
    );
    assert.equal(created, false);
    t.close();
  }
});
void test('bounded reliable queue fails rather than silently dropping simulation inputs', async () => {
  const f = fake();
  let failures = 0;
  const t = new WebTransportTransport(
    { url: 'https://localhost:4433/echo', protocolVersion: 3 },
    f.factory,
  );
  await t.connect(
    '',
    () => {},
    () => failures++,
  );
  for (let i = 0; i < 8; i++) t.sendLatest('x'.repeat(16000));
  await tick();
  assert.equal(failures, 1);
  assert.equal(t.bufferedAmount, 0);
  t.close();
});

void test('a local host uses its pinned loopback endpoint while friends use the public one', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const f = fake();
  let selected = '';
  Object.defineProperty(globalThis, 'location', {
    value: { hostname: '127.0.0.1' },
    configurable: true,
  });
  try {
    const t = new WebTransportTransport(
      {
        url: 'https://public.example:4433/echo',
        loopbackUrl: 'https://127.0.0.1:4433/echo',
        protocolVersion: 3,
      },
      (url, options) => {
        selected = url;
        return f.factory(url, options);
      },
    );
    await t.connect(
      '',
      () => {},
      () => {},
    );
    assert.equal(selected, 'https://127.0.0.1:4433/echo');
    t.close();
  } finally {
    if (original) Object.defineProperty(globalThis, 'location', original);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});
