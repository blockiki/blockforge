import * as THREE from "three";
import { BlockType, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "@blockforge/shared";
import { Chunk, chunkKey } from "./chunk";
import { TerrainGenerator } from "./terrain";
import { ChunkMesher } from "./mesher";

const material = new THREE.MeshLambertMaterial({ vertexColors: true });

/**
 * Fixed-size world for Phase 1 — every chunk in the radius is generated
 * and meshed up front. Dynamic streaming (load/unload as the player
 * moves) is Phase 2; a finite world keeps this stage simple to reason
 * about and to collide against.
 */
export class World {
  private readonly chunks = new Map<string, Chunk>();
  private readonly terrain: TerrainGenerator;
  private readonly mesher = new ChunkMesher();
  readonly group = new THREE.Group();

  constructor(seed: number) {
    this.terrain = new TerrainGenerator(seed);
  }

  generateFixedArea(radiusChunks: number): void {
    for (let cx = -radiusChunks; cx <= radiusChunks; cx++) {
      for (let cz = -radiusChunks; cz <= radiusChunks; cz++) {
        const chunk = new Chunk(cx, cz);
        this.terrain.generate(chunk);
        this.chunks.set(chunkKey(cx, cz), chunk);
      }
    }
    for (const chunk of this.chunks.values()) {
      this.rebuildChunkMesh(chunk);
    }
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  surfaceHeightAt(worldX: number, worldZ: number): number {
    return this.terrain.surfaceHeightAt(worldX, worldZ);
  }

  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return BlockType.Air;
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockType.Air;
    const localX = worldX - cx * CHUNK_SIZE_X;
    const localZ = worldZ - cz * CHUNK_SIZE_Z;
    return chunk.getBlock(localX, worldY, localZ);
  }

  setBlock(worldX: number, worldY: number, worldZ: number, block: BlockType): void {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return;
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const localX = worldX - cx * CHUNK_SIZE_X;
    const localZ = worldZ - cz * CHUNK_SIZE_Z;
    chunk.setBlock(localX, worldY, localZ, block);
    this.rebuildChunkMesh(chunk);

    // A block on a chunk border affects the neighbor's face culling too.
    if (localX === 0) this.rebuildNeighbor(cx - 1, cz);
    if (localX === CHUNK_SIZE_X - 1) this.rebuildNeighbor(cx + 1, cz);
    if (localZ === 0) this.rebuildNeighbor(cx, cz - 1);
    if (localZ === CHUNK_SIZE_Z - 1) this.rebuildNeighbor(cx, cz + 1);
  }

  private rebuildNeighbor(cx: number, cz: number): void {
    const neighbor = this.getChunk(cx, cz);
    if (neighbor) this.rebuildChunkMesh(neighbor);
  }

  private rebuildChunkMesh(chunk: Chunk): void {
    if (chunk.mesh) {
      this.group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }

    const geometry = this.mesher.build(chunk, this);
    chunk.dirty = false;
    if (!geometry) return;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(chunk.worldOriginX, 0, chunk.worldOriginZ);
    chunk.mesh = mesh;
    this.group.add(mesh);
  }
}
