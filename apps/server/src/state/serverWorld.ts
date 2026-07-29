import { BlockType, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, ChunkData, TerrainGenerator, chunkKey } from "@blockforge/shared";
import { loadChunkEdits, saveChunkEdits } from "./worldStore.js";

/**
 * The server's authoritative view of the world (architecture principle
 * #1: the server owns world state, clients only render/input). Reuses
 * the exact same seeded TerrainGenerator the client runs, so the server
 * never needs to transmit base terrain — only the player-made edit diff,
 * loaded from disk on demand and kept in memory per chunk afterward.
 */
export class ServerWorld {
  private readonly chunks = new Map<string, ChunkData>();
  private readonly terrain: TerrainGenerator;

  constructor(private readonly seed: number) {
    this.terrain = new TerrainGenerator(seed);
  }

  private async ensureChunk(cx: number, cz: number): Promise<ChunkData> {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const chunk = new ChunkData(cx, cz);
    this.terrain.generate(chunk);
    const saved = await loadChunkEdits(this.seed, cx, cz);
    if (saved) {
      for (const [localKey, block] of Object.entries(saved)) {
        const [lx, ly, lz] = localKey.split(",").map(Number);
        chunk.setBlock(lx, ly, lz, block as BlockType);
      }
      chunk.edits = saved;
    }
    this.chunks.set(key, chunk);
    return chunk;
  }

  async getChunkEdits(cx: number, cz: number): Promise<Record<string, number>> {
    const chunk = await this.ensureChunk(cx, cz);
    return chunk.edits;
  }

  async getBlock(worldX: number, worldY: number, worldZ: number): Promise<BlockType> {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return BlockType.Air;
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = await this.ensureChunk(cx, cz);
    return chunk.getBlock(worldX - cx * CHUNK_SIZE_X, worldY, worldZ - cz * CHUNK_SIZE_Z);
  }

  async setBlock(worldX: number, worldY: number, worldZ: number, block: BlockType): Promise<void> {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return;
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = await this.ensureChunk(cx, cz);
    const localX = worldX - cx * CHUNK_SIZE_X;
    const localZ = worldZ - cz * CHUNK_SIZE_Z;
    chunk.setBlock(localX, worldY, localZ, block);
    chunk.edits[`${localX},${worldY},${localZ}`] = block;
    await saveChunkEdits(this.seed, cx, cz, chunk.edits);
  }
}
