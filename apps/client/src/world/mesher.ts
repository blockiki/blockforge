import * as THREE from "three";
import { BLOCK_COLORS, CHUNK_SIZE_X, CHUNK_SIZE_Z, isSolidBlock } from "@blockforge/shared";
import type { Chunk } from "./chunk";
import type { World } from "./world";

interface FaceDef {
  normal: readonly [number, number, number];
  corners: readonly (readonly [number, number, number])[];
}

// Unit-cube face vertices, wound CCW as seen from outside (along `normal`)
// so Three.js's default front-face culling keeps them visible.
const FACES: readonly FaceDef[] = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

/**
 * Builds one merged BufferGeometry per chunk using face culling: a face
 * between two solid blocks is never visible, so it's simply never emitted.
 * This is the minimum optimization called for by the spec; greedy meshing
 * (merging coplanar same-block faces into larger quads) would cut the
 * triangle count further but isn't needed at this world size yet.
 */
export class ChunkMesher {
  build(chunk: Chunk, world: World): THREE.BufferGeometry | null {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
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
          const color = BLOCK_COLORS[block];
          const r = ((color >> 16) & 0xff) / 255;
          const g = ((color >> 8) & 0xff) / 255;
          const b = (color & 0xff) / 255;

          for (const face of FACES) {
            const neighbor = world.getBlock(
              worldX + face.normal[0],
              y + face.normal[1],
              worldZ + face.normal[2],
            );
            if (isSolidBlock(neighbor)) continue;

            const startIndex = positions.length / 3;
            for (const corner of face.corners) {
              positions.push(x + corner[0], y + corner[1], z + corner[2]);
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              colors.push(r, g, b);
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
    geometry.setIndex(indices);
    return geometry;
  }
}
