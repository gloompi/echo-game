export interface TransportConfig {
  readonly url: string;
  readonly certificateHashes?: number[][];
  readonly protocolVersion: number;
  readonly loopbackUrl?: string;
}

export interface ResolvedTransportConfig {
  readonly endpoint: string;
  readonly options: {
    serverCertificateHashes?: { algorithm: string; value: Uint8Array }[];
  };
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function readTransportConfig(value: unknown): TransportConfig {
  if (!value || typeof value !== 'object' || !('transport' in value)) {
    throw new Error('The server has no WebTransport endpoint configured.');
  }
  const transport = value.transport;
  if (!transport || typeof transport !== 'object') {
    throw new Error('The server has no WebTransport endpoint configured.');
  }
  if (!('url' in transport) || typeof transport.url !== 'string'
    || !('protocolVersion' in transport) || typeof transport.protocolVersion !== 'number') {
    throw new Error('Invalid WebTransport configuration.');
  }
  if ('loopbackUrl' in transport && transport.loopbackUrl != null && typeof transport.loopbackUrl !== 'string') {
    throw new Error('Invalid local WebTransport endpoint.');
  }
  const hashes = 'certificateHashes' in transport ? transport.certificateHashes : undefined;
  if (hashes !== undefined && !validHashes(hashes)) {
    throw new Error('Invalid certificate fingerprint.');
  }
  return {
    url: transport.url,
    protocolVersion: transport.protocolVersion,
    certificateHashes: hashes,
    loopbackUrl: 'loopbackUrl' in transport && typeof transport.loopbackUrl === 'string'
      ? transport.loopbackUrl : undefined,
  };
}

function validHashes(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length <= 2 && value.every(hash =>
    Array.isArray(hash) && hash.length === 32
      && hash.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255));
}

/** Pure endpoint policy: it can be tested without constructing a QUIC connection. */
export function resolveTransportConfig(
  config: TransportConfig,
  pageHostname: string | undefined,
): ResolvedTransportConfig {
  if (config.protocolVersion !== 3) {
    throw new Error('Client/server versions differ. Rebuild and restart Echo.');
  }
  let endpoint = new URL(config.url);
  // A local host must not depend on router NAT hairpinning while sharing.
  if (pageHostname !== undefined && LOOPBACK_HOSTS.has(pageHostname) && config.loopbackUrl) {
    const local = new URL(config.loopbackUrl);
    if (local.protocol !== 'https:' || !LOOPBACK_HOSTS.has(local.hostname)) {
      throw new Error('Invalid local WebTransport endpoint.');
    }
    endpoint = local;
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error('Invalid WebTransport endpoint.');
  }
  const hashes = config.certificateHashes;
  if (hashes !== undefined && !validHashes(hashes)) {
    throw new Error('Invalid certificate fingerprint.');
  }
  return {
    endpoint: endpoint.href,
    options: hashes?.length ? {
      serverCertificateHashes: hashes.map(hash => ({ algorithm: 'sha-256', value: new Uint8Array(hash) })),
    } : {},
  };
}
