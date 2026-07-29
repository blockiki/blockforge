/**
 * Block type registry — the single source of truth for block IDs.
 * Client (rendering/meshing) and server (world state/persistence) both
 * import this so a block ID always means the same thing on both sides.
 */
export const BlockType = {
  Air: 0,
  Dirt: 1,
  Stone: 2,
  Grass: 3,
  Wood: 4,
  Sand: 5,
  Snow: 6,
  Planks: 7,
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

/** Placeholder solid colors per block, used until textures are introduced. */
export const BLOCK_COLORS: Record<BlockType, number> = {
  [BlockType.Air]: 0x000000,
  [BlockType.Dirt]: 0x8b5a2b,
  [BlockType.Stone]: 0x8a8a8a,
  [BlockType.Grass]: 0x4caf50,
  [BlockType.Wood]: 0x6d4c25,
  [BlockType.Sand]: 0xe0c882,
  [BlockType.Snow]: 0xf0f5f7,
  [BlockType.Planks]: 0xba8a52,
};

export function isSolidBlock(block: BlockType): boolean {
  return block !== BlockType.Air;
}
