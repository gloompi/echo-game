import assert from 'node:assert/strict';
import test from 'node:test';
import { ServerClock, SnapshotCursor } from '../client/network/clock.js';
import { createInviteUrl, fragmentAccessKey, readPublicUrl } from '../client/network/invite.js';
import { readTransportConfig, resolveTransportConfig } from '../client/network/transport-config.js';

test('clock uses snapshots until a valid pong provides an RTT estimate', () => {
  let localNow = 100;
  const clock = new ServerClock(() => localNow);
  clock.observeSnapshot(500);
  assert.equal(clock.now, 500);
  clock.observePong(80, 510);
  assert.equal(clock.ping, 20);
  assert.equal(clock.offset, 420);
  assert.equal(clock.synced, true);
  clock.observeSnapshot(9_000);
  assert.equal(clock.offset, 420);
  localNow = 200;
  assert.equal(clock.now, 620);
});

test('clock rejects invalid, future, and stale pong timestamps', () => {
  const clock = new ServerClock(() => 4_000);
  for (const [sentAt, serverNow] of [[NaN, 10], [0, Infinity], [4_001, 10], [1_000, 10]]) {
    clock.observePong(sentAt, serverNow);
  }
  assert.equal(clock.synced, false);
  assert.equal(clock.offset, 0);
});

test('clock smooths valid measurements and reset removes the previous server epoch', () => {
  const clock = new ServerClock(() => 100);
  clock.observePong(100, 200);
  clock.observePong(100, 300);
  assert.ok(Math.abs(clock.offset - 120) < 1e-9);
  clock.reset();
  assert.deepEqual([clock.now, clock.offset, clock.ping, clock.synced], [100, 0, 0, false]);
});

test('snapshot cursor rejects duplicates, old frames, and non-finite times', () => {
  const cursor = new SnapshotCursor();
  assert.equal(cursor.accept(30), true);
  for (const time of [30, 20, NaN, Infinity, -Infinity]) assert.equal(cursor.accept(time), false);
  assert.equal(cursor.accept(40), true);
  cursor.reset();
  assert.equal(cursor.accept(1), true);
});

test('invitations preserve the fragment and path but replace all query parameters', () => {
  const url = createInviteUrl('ABC234', { origin: 'https://local.example', hash: '#key=a%26b' },
    'https://friends.example/play?tracking=old#wrong');
  assert.equal(url, 'https://friends.example/play?room=ABC234#key=a%26b');
  assert.equal(fragmentAccessKey(new URL(url).hash), 'a&b');
});

test('local invitations work without a public URL or access key', () => {
  assert.equal(createInviteUrl('ABC234', { origin: 'http://127.0.0.1:3000', hash: '' }, null),
    'http://127.0.0.1:3000/?room=ABC234');
  assert.equal(fragmentAccessKey('#unrelated=value'), undefined);
});

test('invitations reject non-web protocols and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/game', 'https://user:secret@host/']) {
    assert.throws(() => createInviteUrl('ABC234', { origin: 'https://host', hash: '' }, url));
  }
});

test('public URL discovery reads unknown JSON without trusting a cast', () => {
  for (const value of [null, 12, 'url', [], {}, { publicUrl: 42 }]) {
    assert.equal(readPublicUrl(value), undefined);
  }
  assert.equal(readPublicUrl({ publicUrl: 'https://host' }), 'https://host');
});

test('transport discovery accepts the server null loopback URL representation', () => {
  const config = readTransportConfig({ transport: {
    url: 'https://host/echo', protocolVersion: 3, certificateHashes: [], loopbackUrl: null,
  } });
  assert.equal(config.loopbackUrl, undefined);
  assert.equal(resolveTransportConfig(config, 'friend.example').endpoint, 'https://host/echo');
});

test('transport discovery rejects malformed unknown JSON', () => {
  for (const transport of [null, false, [], {}, { url: 42, protocolVersion: 3 },
    { url: 'https://host/echo', protocolVersion: '3' },
    { url: 'https://host/echo', protocolVersion: 3, loopbackUrl: 4 }]) {
    assert.throws(() => readTransportConfig({ transport }));
  }
  assert.throws(() => readTransportConfig(null));
});

test('local hosts use loopback while remote players retain the public endpoint', () => {
  const config = { url: 'https://public.example/echo', protocolVersion: 3,
    loopbackUrl: 'https://127.0.0.1:4433/echo' };
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(resolveTransportConfig(config, hostname).endpoint, config.loopbackUrl);
  }
  for (const hostname of ['friend.example', undefined]) {
    assert.equal(resolveTransportConfig(config, hostname).endpoint, config.url);
  }
});

test('transport configuration validates protocol, scheme, credentials, and fragments', () => {
  for (const url of ['http://host/echo', 'https://user:secret@host/echo', 'https://host/echo#key']) {
    assert.throws(() => resolveTransportConfig({ url, protocolVersion: 3 }, undefined));
  }
  assert.throws(() => resolveTransportConfig({ url: 'https://host/echo', protocolVersion: 2 }, undefined));
  assert.throws(() => resolveTransportConfig({ url: 'https://host/echo', protocolVersion: 3,
    loopbackUrl: 'https://attacker.example/echo' }, 'localhost'));
});

test('certificate pins must be at most two complete SHA-256 byte arrays', () => {
  const pin = Array.from({ length: 32 }, (_, index) => index);
  const config = { url: 'https://host/echo', protocolVersion: 3, certificateHashes: [pin] };
  const resolved = resolveTransportConfig(config, undefined);
  assert.deepEqual(resolved.options.serverCertificateHashes?.[0]?.value, new Uint8Array(pin));
  for (const hashes of [[[]], [[1]], [Array(32).fill(-1)], [Array(32).fill(256)],
    [Array(32).fill(1.5)], [pin, pin, pin]]) {
    assert.throws(() => resolveTransportConfig({ ...config, certificateHashes: hashes }, undefined));
  }
});
