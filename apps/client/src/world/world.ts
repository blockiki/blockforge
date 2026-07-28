import * as THREE from "three";
import { BlockType, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "@blockforge/shared";
import { Chunk, chunkKey } from "./chunk";
import { TerrainGenerator } from "./terrain";
import { ChunkMesher } from "./mesher";
import { buildTextureAtlas } from "./textureAtlas";
import { loadChunkEdits, saveChunkEdits } from "../persistence/worldStorage";

// How far around the player chunks stay loaded/meshed. Unload uses a
// slightly larger radius than load (hysteresis) so a player oscillating
// near a boundary doesn't repeatedly load/unload the same chunk.
const LOAD_RADIUS_CHUNKS = 4;
const UNLOAD_RADIUS_CHUNKS = LOAD_RADIUS_CHUNKS + 2;
// Generating+meshing a chunk costs a few ms; spreading loads across
// frames instead of doing the whole radius at once avoids a startup/
// movement hitch. The player's immediate surroundings are still loaded
// synchronously via loadAreaSync so they never spawn into a void.
const MAX_CHUNK_LOADS_PER_UPDATE = 2;

function localEditKey(lx: number, ly: number, lz: number): string {
  return `${lx},${ly},${lz}`;
}

interface QueuedChunk {
  cx: number;
  cz: number;
}

/**
 * Streams chunks in/out around the player instead of generating a fixed
 * area once (Phase 1). Chunk lookups stay O(1) throughout: a hash map
 * from chunk coords to a flat per-chunk block array, so both world
 * queries and collision checks never scan more than the handful of
 * blocks they actually need — an octree would add tree-descent cost
 * without buying anything on top of that for a uniform voxel grid.
 */
export class World {
  private readonly chunks = new Map<string, Chunk>();
  private readonly terrain: TerrainGenerator;
  private readonly mesher: ChunkMesher;
  private readonly material: THREE.Material;
  readonly group = new THREE.Group();

  private readonly pendingLoads: QueuedChunk[] = [];
  private readonly queuedKeys = new Set<string>();
  private lastPlayerChunk: QueuedChunk | null = null;

  constructor(private readonly seed: number) {
    this.terrain = new TerrainGenerator(seed);
    const atlas = buildTextureAtlas();
    this.mesher = new ChunkMesher(atlas.getTileUV);
    this.material = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true });
  }

  surfaceHeightAt(worldX: number, worldZ: number): number {
    return this.terrain.surfaceHeightAt(worldX, worldZ);
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return BlockType.Air;
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockType.Air;
    return chunk.getBlock(worldX - cx * CHUNK_SIZE_X, worldY, worldZ - cz * CHUNK_SIZE_Z);
  }

  setBlock(worldX: number, worldY: number, worldZ: number, block: BlockType): void {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return;
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return; // interaction reach is far smaller than the load radius

    const localX = worldX - cx * CHUNK_SIZE_X;
    const localZ = worldZ - cz * CHUNK_SIZE_Z;
    chunk.setBlock(localX, worldY, localZ, block);
    chunk.edits[localEditKey(localX, worldY, localZ)] = block;
    saveChunkEdits(this.seed, cx, cz, chunk.edits).catch((err) => {
      console.warn("[world] failed to save chunk edit", err);
    });
    this.rebuildChunkMesh(chunk);

    // A block on a chunk border affects the neighbor's face culling too.
    if (localX === 0) this.rebuildNeighbor(cx - 1, cz);
    if (localX === CHUNK_SIZE_X - 1) this.rebuildNeighbor(cx + 1, cz);
    if (localZ === 0) this.rebuildNeighbor(cx, cz - 1);
    if (localZ === CHUNK_SIZE_Z - 1) this.rebuildNeighbor(cx, cz + 1);
  }

  /** Synchronously loads a small area so the player never spawns into an empty void. */
  loadAreaSync(centerWorldX: number, centerWorldZ: number, radiusChunks: number): void {
    const cx0 = Math.floor(centerWorldX / CHUNK_SIZE_X);
    const cz0 = Math.floor(centerWorldZ / CHUNK_SIZE_Z);
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
        this.loadChunk(cx0 + dx, cz0 + dz);
      }
    }
    this.lastPlayerChunk = { cx: cx0, cz: cz0 };
  }

  /** Call once per frame with the player's world position to stream chunks in/out. */
  update(playerWorldX: number, playerWorldZ: number): void {
    const playerCX = Math.floor(playerWorldX / CHUNK_SIZE_X);
    const playerCZ = Math.floor(playerWorldZ / CHUNK_SIZE_Z);

    if (!this.lastPlayerChunk || this.lastPlayerChunk.cx !== playerCX || this.lastPlayerChunk.cz !== playerCZ) {
      this.lastPlayerChunk = { cx: playerCX, cz: playerCZ };
      this.recomputeLoadQueue(playerCX, playerCZ);
      this.unloadFarChunks(playerCX, playerCZ);
    }

    for (let i = 0; i < MAX_CHUNK_LOADS_PER_UPDATE && this.pendingLoads.length > 0; i++) {
      const next = this.pendingLoads.shift()!;
      this.queuedKeys.delete(chunkKey(next.cx, next.cz));
      this.loadChunk(next.cx, next.cz);
    }
  }

  private recomputeLoadQueue(playerCX: number, playerCZ: number): void {
    const candidates: (QueuedChunk & { dist2: number })[] = [];
    for (let dx = -LOAD_RADIUS_CHUNKS; dx <= LOAD_RADIUS_CHUNKS; dx++) {
      for (let dz = -LOAD_RADIUS_CHUNKS; dz <= LOAD_RADIUS_CHUNKS; dz++) {
        const cx = playerCX + dx;
        const cz = playerCZ + dz;
        const key = chunkKey(cx, cz);
        if (this.chunks.has(key) || this.queuedKeys.has(key)) continue;
        candidates.push({ cx, cz, dist2: dx * dx + dz * dz });
      }
    }
    candidates.sort((a, b) => a.dist2 - b.dist2);
    for (const candidate of candidates) {
      this.pendingLoads.push(candidate);
      this.queuedKeys.add(chunkKey(candidate.cx, candidate.cz));
    }
  }

  private unloadFarChunks(playerCX: number, playerCZ: number): void {
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - playerCX;
      const dz = chunk.cz - playerCZ;
      if (Math.max(Math.abs(dx), Math.abs(dz)) > UNLOAD_RADIUS_CHUNKS) {
        this.disposeMesh(chunk);
        this.chunks.delete(key);
      }
    }
  }

  private loadChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return;

    const chunk = new Chunk(cx, cz);
    this.terrain.generate(chunk);
    this.chunks.set(key, chunk);
    this.rebuildChunkMesh(chunk);

    loadChunkEdits(this.seed, cx, cz).then((saved) => {
      if (!saved || !this.chunks.has(key)) return; // chunk may have been unloaded by the time this resolves
      for (const [localKey, block] of Object.entries(saved)) {
        const [lx, ly, lz] = localKey.split(",").map(Number);
        chunk.setBlock(lx, ly, lz, block as BlockType);
      }
      // Edits made in the brief window before this resolved take priority.
      chunk.edits = { ...saved, ...chunk.edits };
      this.rebuildChunkMesh(chunk);
    });
  }

  private disposeMesh(chunk: Chunk): void {
    if (!chunk.mesh) return;
    this.group.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    chunk.mesh = null;
  }

  private rebuildNeighbor(cx: number, cz: number): void {
    const neighbor = this.getChunk(cx, cz);
    if (neighbor) this.rebuildChunkMesh(neighbor);
  }

  private rebuildChunkMesh(chunk: Chunk): void {
    this.disposeMesh(chunk);

    const geometry = this.mesher.build(chunk, this);
    chunk.dirty = false;
    if (!geometry) return;

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(chunk.worldOriginX, 0, chunk.worldOriginZ);
    chunk.mesh = mesh;
    this.group.add(mesh);
  }
}
