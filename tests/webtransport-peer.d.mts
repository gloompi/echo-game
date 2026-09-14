import type { Page } from '@playwright/test';
import type { ClientMessage, ServerMessage } from '../shared/types.js';
export function connectPeer(
  page: Page,
  join: Extract<ClientMessage, { type: 'join' }>,
): Promise<{
  send(message: ClientMessage): Promise<void>;
  close(): Promise<void>;
  wait<T extends ServerMessage>(predicate: (message: T) => boolean): Promise<T>;
}>;
