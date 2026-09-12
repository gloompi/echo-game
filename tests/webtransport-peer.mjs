// A native browser peer for protocol integration tests; no mocked QUIC or TLS.
export async function connectPeer(page, join) {
  const id = await page.evaluate(async joinMessage => {
    const { transport: config } = await (await fetch('/api/config')).json();
    if (config.protocolVersion !== 3) throw new Error('Expected protocol 3');
    const transport = new WebTransport(config.loopbackUrl || config.url, {
      serverCertificateHashes: config.certificateHashes.map(value => ({ algorithm: 'sha-256', value: new Uint8Array(value) })),
    });
    const peer = { transport, messages: [], closed: false, error: '', tail: Promise.resolve() };
    transport.closed.then(() => { peer.closed = true; }, error => { peer.closed = true; peer.error = String(error); });
    await transport.ready;
    const stream = await transport.createBidirectionalStream();
    const writer = stream.writable.getWriter();
    peer.send = message => {
      const body = new TextEncoder().encode(JSON.stringify(message)), bytes = new Uint8Array(4 + body.length);
      new DataView(bytes.buffer).setUint32(0, body.length); bytes.set(body, 4);
      peer.tail = peer.tail.then(() => writer.write(bytes));
      return peer.tail;
    };
    const read = async readable => {
      const reader = readable.getReader(); let buffer = new Uint8Array();
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          const combined = new Uint8Array(buffer.length + value.length); combined.set(buffer); combined.set(value, buffer.length); buffer = combined;
          while (buffer.length >= 4) {
            const length = new DataView(buffer.buffer, buffer.byteOffset).getUint32(0);
            if (!length || length > 262144) throw new Error('Invalid frame length');
            if (buffer.length < 4 + length) break;
            peer.messages.push(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(4, 4 + length))));
            if (peer.messages.length > 256) peer.messages.shift();
            buffer = buffer.slice(4 + length);
          }
        }
        if (buffer.length) throw new Error('Truncated frame');
      } finally { reader.releaseLock(); }
    };
    const failed = error => { if (!peer.closed) peer.error = String(error); };
    void read(stream.readable).catch(failed);
    void (async () => {
      const reader = transport.incomingUnidirectionalStreams.getReader();
      try { for (;;) { const item = await reader.read(); if (item.done) break; void read(item.value).catch(failed); } }
      finally { reader.releaseLock(); }
    })().catch(failed);
    globalThis.echoTestPeers ??= [];
    const id = globalThis.echoTestPeers.push(peer) - 1;
    await peer.send(joinMessage);
    return id;
  }, join);
  return {
    send: message => page.evaluate(({ id, message }) => globalThis.echoTestPeers[id].send(message), { id, message }),
    close: () => page.evaluate(id => globalThis.echoTestPeers[id].transport.close(), id),
    wait: async predicate => {
      for (let i = 0; i < 240; i++) {
        const state = await page.evaluate(id => {
          const p = globalThis.echoTestPeers[id]; return { messages: p.messages, closed: p.closed, error: p.error };
        }, id);
        const found = state.messages.find(predicate); if (found) return found;
        if (state.closed || state.error) throw new Error(`Transport ended: ${state.error}`);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error('No matching WebTransport message');
    },
  };
}
