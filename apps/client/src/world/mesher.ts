import * as THREE from "three";
import { type BlockType, type ChunkData, CHUNK_SIZE_X, CHUNK_SIZE_Z, isSolidBlock } from "@blockforge/shared";
import type { World } from "./world";
import type { TileUV } from "./textureAtlas";

interface FaceDef {
  normal: readonly [number, number, number];
  corners: readonly (readonly [number, number, number])[];
  /** Fake directional shading (no per-face lighting calc needed): top
   * brighter, bottom darker, sides in between — reads as subtle ambient
   * occlusion even under flat light. */
  shade: number;
}

// Unit-cube face vertices, wound CCW as seen from outside (along `normal`)
// so Three.js's default front-face culling keeps them visible.
const FACES: readonly FaceDef[] = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.8 },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.8 },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8 },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 },
];

// Canonical UV corners in the same winding order as FACES[i].corners, so
// corner index N always maps to the same tile corner regardless of face.
const CORNER_UVS: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

/**
 * Builds one merged BufferGeometry per chunk using face culling: a face
 * between two solid blocks is never visible, so it's simply never emitted.
 * This is the minimum optimization called for by the spec; greedy meshing
 * (merging coplanar same-block faces into larger quads) would cut the
 * triangle count further but isn't needed at this world size yet.
 */
export class ChunkMesher {
  constructor(private readonly getTileUV: (block: BlockType) => TileUV) {}

  build(chunk: ChunkData, world: World): THREE.BufferGeometry | null {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const originX = chunk.worldOriginX;
    const originZ = chunk.worldOriginZ;

    // Scan only up to the chunk's known highest solid block instead of the
    // full 256-tall column — the sky above terrain is always empty air.
    for (let y = 0; y <= chunk.highestSolidY; y++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        for (let x = 0; x < CHUNK_SIZE_X; x++) {
          const block = chunk.getBlock(x, y, z);
          if (!isSolidBlock(block)) continue;

          const worldX = originX + x;
          const worldZ = originZ + z;
          const tile = this.getTileUV(block);

          for (const face of FACES) {
            const neighbor = world.getBlock(
              worldX + face.normal[0],
              y + face.normal[1],
              worldZ + face.normal[2],
            );
            if (isSolidBlock(neighbor)) continue;

            const startIndex = positions.length / 3;
            for (let ci = 0; ci < 4; ci++) {
              const corner = face.corners[ci];
              positions.push(x + corner[0], y + corner[1], z + corner[2]);
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              colors.push(face.shade, face.shade, face.shade);
              const [cu, cv] = CORNER_UVS[ci];
              uvs.push(tile.u0 + cu * (tile.u1 - tile.u0), tile.v0 + cv * (tile.v1 - tile.v0));
            }
            indices.push(
              startIndex,
              startIndex + 1,
              startIndex + 2,
              startIndex,
              startIndex + 2,
              startIndex + 3,
            );
          }
        }
      }
    }

    if (indices.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }
}
