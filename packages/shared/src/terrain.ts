import { createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D } from "simplex-noise";
import { BlockType } from "./blocks.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "./chunk.js";
import { ChunkData } from "./chunkData.js";

const SEA_LEVEL = 40;
const BASE_HEIGHT = 48;
const HEIGHT_AMPLITUDE = 20;
const DETAIL_AMPLITUDE = 4;
const SURFACE_LAYER_DEPTH = 3; // blocks of dirt beneath the top block
const CAVE_THRESHOLD = 0.62; // higher = rarer caves
const SNOW_LINE = 64; // surface at/above this height caps with snow
const TREE_CHANCE = 0.01; // fraction of eligible grass columns that grow a trunk
const TREE_HEIGHT = 4;

/** Deterministic per-column pseudo-random value in [0, 1), independent of
 * the noise fields — used only to decide tree placement, so it doesn't
 * need its own seeded noise generator instance. */
function hash01(x: number, z: number, seed: number): number {
  let h = (x * 374761393 + z * 668265263 + seed * 69069) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Deterministic PRNG from a numeric seed, used to seed the noise functions. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seed-deterministic terrain: a fixed seed always regenerates the same
 * world, since height/cave shape is a pure function of world coordinates
 * and the seeded noise fields (no per-chunk randomness). Both the client
 * (to render chunks without waiting on the network) and the server (to
 * validate block edits) run this exact same generator.
 */
export class TerrainGenerator {
  private readonly heightNoise: NoiseFunction2D;
  private readonly detailNoise: NoiseFunction2D;
  private readonly caveNoise: NoiseFunction3D;

  constructor(private readonly seed: number) {
    const rng = mulberry32(seed);
    this.heightNoise = createNoise2D(rng);
    this.detailNoise = createNoise2D(rng);
    this.caveNoise = createNoise3D(rng);
  }

  surfaceHeightAt(worldX: number, worldZ: number): number {
    const base = this.heightNoise(worldX * 0.01, worldZ * 0.01) * HEIGHT_AMPLITUDE;
    const detail = this.detailNoise(worldX * 0.05, worldZ * 0.05) * DETAIL_AMPLITUDE;
    return Math.floor(BASE_HEIGHT + base + detail);
  }

  generate(chunk: ChunkData): void {
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        const worldX = chunk.worldOriginX + x;
        const worldZ = chunk.worldOriginZ + z;
        const surfaceY = Math.min(this.surfaceHeightAt(worldX, worldZ), CHUNK_SIZE_Y - 1);
        const topBlock =
          surfaceY >= SNOW_LINE
            ? BlockType.Snow
            : surfaceY <= SEA_LEVEL + 1
              ? BlockType.Sand
              : BlockType.Grass;

        for (let y = 0; y <= surfaceY; y++) {
          let block: BlockType;
          if (y === surfaceY) block = topBlock;
          else if (y >= surfaceY - SURFACE_LAYER_DEPTH) block = BlockType.Dirt;
          else block = BlockType.Stone;

          // Carve caves only underground, never right at the surface.
          if (y > 1 && y < surfaceY - 1) {
            const cave = this.caveNoise(worldX * 0.08, y * 0.08, worldZ * 0.08);
            if (cave > CAVE_THRESHOLD) block = BlockType.Air;
          }

          chunk.setBlock(x, y, z, block);
        }

        // Bare trunks only (no canopy/Leaves block yet) — enough to make
        // Wood an actual gatherable resource for crafting, without
        // introducing another block type just for foliage.
        if (
          topBlock === BlockType.Grass &&
          surfaceY + TREE_HEIGHT < CHUNK_SIZE_Y - 1 &&
          hash01(worldX, worldZ, this.seed) < TREE_CHANCE
        ) {
          for (let ty = 1; ty <= TREE_HEIGHT; ty++) {
            chunk.setBlock(x, surfaceY + ty, z, BlockType.Wood);
          }
        }
      }
    }
  }
}
