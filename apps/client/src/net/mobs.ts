import * as THREE from "three";
import type { MobInfo, Vec3 } from "@blockforge/shared";

const MOB_WIDTH = 0.7;
const MOB_HEIGHT = 1.3;
const LERP_RATE = 8; // slightly slower than remote players — mobs update at ~6.7Hz (server tick)

interface MobVisual {
  mesh: THREE.Mesh;
  targetPosition: THREE.Vector3;
  targetYaw: number;
}

function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Renders server-authoritative mobs as simple colored boxes, smoothing
 * toward each position/yaw update from the server's tick loop instead of
 * snapping — same interpolation approach as RemotePlayers.
 */
export class MobRenderer {
  private readonly mobs = new Map<string, MobVisual>();
  private readonly geometry = new THREE.BoxGeometry(MOB_WIDTH, MOB_HEIGHT, MOB_WIDTH);
  private readonly material = new THREE.MeshLambertMaterial({ color: 0x7a1f3d });

  constructor(private readonly scene: THREE.Scene) {}

  add(mob: MobInfo): void {
    if (this.mobs.has(mob.id)) return;
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.position.set(mob.position[0], mob.position[1] + MOB_HEIGHT / 2, mob.position[2]);
    mesh.rotation.y = mob.yaw;
    this.scene.add(mesh);
    this.mobs.set(mob.id, {
      mesh,
      targetPosition: new THREE.Vector3(mob.position[0], mob.position[1] + MOB_HEIGHT / 2, mob.position[2]),
      targetYaw: mob.yaw,
    });
  }

  remove(id: string): void {
    const visual = this.mobs.get(id);
    if (!visual) return;
    this.scene.remove(visual.mesh);
    this.mobs.delete(id);
  }

  updateTarget(id: string, position: Vec3, yaw: number): void {
    const visual = this.mobs.get(id);
    if (!visual) return;
    visual.targetPosition.set(position[0], position[1] + MOB_HEIGHT / 2, position[2]);
    visual.targetYaw = yaw;
  }

  update(dt: number): void {
    const t = 1 - Math.exp(-LERP_RATE * dt);
    for (const visual of this.mobs.values()) {
      visual.mesh.position.lerp(visual.targetPosition, t);
      visual.mesh.rotation.y += shortestAngleDelta(visual.mesh.rotation.y, visual.targetYaw) * t;
    }
  }
}
