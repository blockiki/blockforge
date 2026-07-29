import { BlockType } from "./blocks.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "./chunk.js";

/**
 * Pure block storage for one chunk — a flat Uint8Array (instead of a 3D
 * array of objects) keeps memory tight (~64KB/chunk at 16x256x16) and
 * gives cache-friendly linear access during meshing/terrain generation.
 * Has no rendering dependency (no Three.js) so both the client and the
 * server can generate and hold identical chunk data.
 */
export class ChunkData {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  dirty = true;
  /**
   * Highest Y with a non-air block. A chunk is 256 blocks tall but terrain
   * only occupies a fraction of that; the mesher scans up to this instead
   * of the full height, skipping the empty sky above every column.
   */
  highestSolidY = 0;
  /**
   * Player-made changes since generation, keyed by "lx,ly,lz". Terrain
   * itself is a pure function of the seed and never needs saving — only
   * this diff does, which is what the server persists.
   */
  edits: Record<string, number> = {};

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
  }

  static inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < CHUNK_SIZE_X && y >= 0 && y < CHUNK_SIZE_Y && z >= 0 && z < CHUNK_SIZE_Z;
  }

  private static index(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE_Z + z) * CHUNK_SIZE_X + x;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (!ChunkData.inBounds(x, y, z)) return BlockType.Air;
    return this.blocks[ChunkData.index(x, y, z)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, block: BlockType): void {
    if (!ChunkData.inBounds(x, y, z)) return;
    this.blocks[ChunkData.index(x, y, z)] = block;
    if (block !== BlockType.Air && y > this.highestSolidY) this.highestSolidY = y;
    this.dirty = true;
  }

  get worldOriginX(): number {
    return this.cx * CHUNK_SIZE_X;
  }

  get worldOriginZ(): number {
    return this.cz * CHUNK_SIZE_Z;
  }
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
