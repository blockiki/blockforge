import * as THREE from "three";
import { isSolidBlock } from "@blockforge/shared";
import type { World } from "../world/world";

export interface VoxelHit {
  /** Coordinates of the solid block the ray hit. */
  block: THREE.Vector3;
  /** The empty cell just before the hit — where a new block would be placed. */
  place: THREE.Vector3;
}

const STEP = 0.05;

/**
 * Marches a ray in small fixed steps and checks the voxel grid at each
 * point. Simpler (and, at these interaction distances, cheap enough) than
 * a proper DDA/Amanatides-Woo grid traversal, and only runs on click —
 * never per frame — so the extra samples don't matter for performance.
 */
export function raycastVoxels(
  world: World,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
): VoxelHit | null {
  let prev: THREE.Vector3 | null = null;

  for (let t = 0; t <= maxDistance; t += STEP) {
    const x = Math.floor(origin.x + direction.x * t);
    const y = Math.floor(origin.y + direction.y * t);
    const z = Math.floor(origin.z + direction.z * t);

    if (isSolidBlock(world.getBlock(x, y, z))) {
      const block = new THREE.Vector3(x, y, z);
      const place = prev ?? new THREE.Vector3(x, y + 1, z);
      return { block, place };
    }
    prev = new THREE.Vector3(x, y, z);
  }
  return null;
}
