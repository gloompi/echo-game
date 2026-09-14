import assert from 'node:assert/strict';
import test from 'node:test';
import { Connection, type ConnectionEnvironment } from '../client/network.js';
import type { GameTransport } from '../client/transport.js';
import type { ServerMessage } from '../shared/types.js';

class FakeTransport implements GameTransport {
  bufferedAmount = 0;
  sent: string[] = [];
  closed = 0;
  accept = true;
  duringSend: () => void = () => {};
  deliver: (message: ServerMessage) => void = () => {};
  disconnected: () => void = () => {};

  async connect(_url: string, message: (value: ServerMessage) => void, closed: () => void): Promise<void> {
    this.deliver = message;
    this.disconnected = closed;
  }

  sendReliable(text: string): boolean {
    this.duringSend();
    if (this.accept) this.sent.push(text);
    return this.accept;
  }

  sendLatest(text: string): boolean { return this.sendReliable(text); }
  close(): void { this.closed++; }
}

const environment: ConnectionEnvironment = {
  now: () => 100,
  location: () => ({ origin: 'http://localhost:3000', hash: '#key=fragment' }),
  fetch: async () => new Response('{}'),
};
const join = { type: 'join', mode: 'create', name: 'A' } as const;

test('synchronous transport factory errors reach the failure callback', () => {
  const failures: string[] = [];
  const connection = new Connection(() => {}, reason => failures.push(reason), () => {},
    () => { throw new Error('factory unavailable'); }, environment);
  assert.doesNotThrow(() => connection.connect(join));
  assert.deepEqual(failures, ['factory unavailable']);
  connection.close();
});

test('synchronous adapter connect errors close the partially opened session', () => {
  const wire = new FakeTransport();
  wire.connect = () => { throw new Error('adapter unavailable'); };
  const failures: string[] = [];
  const connection = new Connection(() => {}, reason => failures.push(reason), () => {}, () => wire, environment);
  connection.connect(join);
  assert.deepEqual(failures, ['adapter unavailable']);
  assert.equal(wire.closed, 1);
  connection.close();
});

test('an unsuccessful join fails immediately, even below the congestion limit', async () => {
  const wire = new FakeTransport();
  wire.accept = false;
  const failures: string[] = [];
  const connection = new Connection(() => {}, reason => failures.push(reason), () => {}, () => wire, environment);
  try {
    connection.connect(join);
    await Promise.resolve();
    assert.equal(failures.length, 1);
    assert.equal(wire.closed, 1);
    assert.equal(wire.sent.length, 0);
  } finally {
    connection.close();
  }
});

test('a synchronous close during join cannot install an orphan keepalive', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const wire = new FakeTransport();
  const failures: string[] = [];
  const connection = new Connection(() => {}, reason => failures.push(reason), () => {}, () => wire, environment);
  const send = context.mock.method(connection, 'send');
  wire.duringSend = () => connection.close();
  connection.connect(join);
  await Promise.resolve();
  context.mock.timers.tick(20_000);
  assert.equal(send.mock.callCount(), 1);
  assert.deepEqual(failures, []);
  connection.close();
});

test('explicit close is idempotent and late callbacks cannot fail the next room', async () => {
  const wire = new FakeTransport();
  const failures: string[] = [];
  const connection = new Connection(() => {}, reason => failures.push(reason), () => {}, () => wire, environment);
  connection.connect(join);
  await Promise.resolve();
  connection.close();
  connection.close();
  wire.disconnected();
  wire.deliver({ type: 'error', message: 'stale failure' });
  assert.equal(wire.closed, 1);
  assert.deepEqual(failures, []);
});

test('explicit join keys take precedence over invitation fragments', async () => {
  const wire = new FakeTransport();
  const connection = new Connection(() => {}, () => {}, () => {}, () => wire, environment);
  try {
    connection.connect({ ...join, accessKey: 'explicit' });
    await Promise.resolve();
    assert.equal(JSON.parse(wire.sent[0]).accessKey, 'explicit');
  } finally {
    connection.close();
  }
});

test('invitation discovery cannot overwrite a newer connection generation', async () => {
  let resolveResponse!: (response: Response) => void;
  const connection = new Connection(() => {}, () => {}, () => {}, () => new FakeTransport(), {
    ...environment,
    fetch: () => new Promise(resolve => { resolveResponse = resolve; }),
  });
  try {
    const invitation = connection.invite('ABC234');
    connection.connect(join);
    resolveResponse(new Response(JSON.stringify({ publicUrl: 'https://old.example' })));
    assert.equal(await invitation, 'https://old.example/?room=ABC234#key=fragment');
    assert.equal(connection.publicUrl, null);
  } finally {
    connection.close();
  }
});

test('invalid discovery URLs retain the last usable invitation endpoint', async () => {
  const connection = new Connection(() => {}, () => {}, () => {}, () => new FakeTransport(), {
    ...environment,
    fetch: async () => new Response(JSON.stringify({ publicUrl: 'javascript:alert(1)' })),
  });
  assert.equal(await connection.invite('ABC234'), 'http://localhost:3000/?room=ABC234#key=fragment');
  assert.equal(connection.publicUrl, null);
  connection.close();
});
