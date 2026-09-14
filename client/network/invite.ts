export interface InviteLocation {
  readonly origin: string;
  readonly hash: string;
}

export function fragmentAccessKey(hash: string): string | undefined {
  return new URLSearchParams(hash.replace(/^#/, '')).get('key') ?? undefined;
}

/** Invitation keys belong in the fragment, never the query or URL credentials. */
export function createInviteUrl(
  room: string,
  location: InviteLocation,
  publicUrl: string | null,
): string {
  const url = new URL(publicUrl || location.origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid public game URL.');
  }
  url.search = '';
  url.searchParams.set('room', room);
  url.hash = location.hash;
  return url.toString();
}

/** Configuration is untrusted JSON, even when it arrives over the same origin. */
export function readPublicUrl(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('publicUrl' in value)) return undefined;
  return typeof value.publicUrl === 'string' ? value.publicUrl : undefined;
}
