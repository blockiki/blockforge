import { BlockType } from "@blockforge/shared";

/**
 * Per-player item counts. Kept client-local (not server-synced) — unlike
 * block edits, an inventory is private state that doesn't affect other
 * players' view of the shared world, so it doesn't need the same
 * server-authority treatment as world state does.
 */
export class Inventory {
  private readonly counts = new Map<BlockType, number>();
  private readonly listeners: (() => void)[] = [];

  getCount(block: BlockType): number {
    return this.counts.get(block) ?? 0;
  }

  add(block: BlockType, amount: number): void {
    if (block === BlockType.Air || amount <= 0) return;
    this.counts.set(block, this.getCount(block) + amount);
    this.notify();
  }

  /** Returns false without changing anything if there isn't enough. */
  remove(block: BlockType, amount: number): boolean {
    const current = this.getCount(block);
    if (current < amount) return false;
    this.counts.set(block, current - amount);
    this.notify();
    return true;
  }

  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
