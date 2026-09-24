const MAX_ROUND_TRIP_MS = 3_000;
const PREVIOUS_OFFSET_WEIGHT = 0.8;

/** Estimate server time without allowing wall-clock changes into prediction. */
export class ServerClock {
  offset = 0;
  ping = 0;
  synced = false;

  constructor(private readonly monotonicNow: () => number) {}

  reset(): void {
    this.offset = 0;
    this.ping = 0;
    this.synced = false;
  }

  observeSnapshot(serverNow: number): void {
    if (!this.synced && Number.isFinite(serverNow)) {
      this.offset = serverNow - this.monotonicNow();
    }
  }

  observePong(sentAt: number, serverNow: number): void {
    const now = this.monotonicNow();
    const roundTrip = now - sentAt;
    if (!Number.isFinite(roundTrip) || !Number.isFinite(serverNow)) return;
    if (roundTrip < 0 || roundTrip >= MAX_ROUND_TRIP_MS) return;

    const measuredOffset = serverNow + roundTrip / 2 - now;
    this.ping = roundTrip;
    this.offset = this.synced
      ? this.offset * PREVIOUS_OFFSET_WEIGHT + measuredOffset * (1 - PREVIOUS_OFFSET_WEIGHT)
      : measuredOffset;
    this.synced = true;
  }

  get now(): number {
    return this.monotonicNow() + this.offset;
  }
}

/** One connection generation may only advance its observation timestamp. */
export class SnapshotCursor {
  private newest = -Infinity;

  reset(): void {
    this.newest = -Infinity;
  }

  accept(timestamp: number): boolean {
    if (!Number.isFinite(timestamp) || timestamp <= this.newest) return false;
    this.newest = timestamp;
    return true;
  }
}
