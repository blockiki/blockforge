import * as THREE from "three";
import { isSolidBlock } from "@blockforge/shared";
import type { World } from "../world/world";
import { InputState } from "./input";

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const MOVE_SPEED = 5;
const JUMP_SPEED = 9;
const GRAVITY = -28;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;

const HALF_WIDTH = PLAYER_WIDTH / 2;

/**
 * Feet-anchored first-person controller: WASD relative to camera yaw,
 * pointer-lock mouse look, gravity + jump, and simple per-axis AABB
 * collision against the voxel world (resolve X, then Z, then Y so the
 * player slides along walls instead of stopping dead on contact).
 */
export class FirstPersonController {
  readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly world: World,
    private readonly input: InputState,
  ) {
    this.camera.rotation.order = "YXZ";

    this.domElement.addEventListener("click", () => {
      this.domElement.requestPointerLock();
    });
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== this.domElement) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
    });
  }

  spawnAt(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  get lookYaw(): number {
    return this.yaw;
  }

  update(dt: number): void {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.yaw, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0));

    let moveForward = 0;
    let moveRight = 0;
    if (this.input.isDown("KeyW")) moveForward += 1;
    if (this.input.isDown("KeyS")) moveForward -= 1;
    if (this.input.isDown("KeyD")) moveRight += 1;
    if (this.input.isDown("KeyA")) moveRight -= 1;

    const moveVec = new THREE.Vector2(moveRight, moveForward);
    if (moveVec.lengthSq() > 1) moveVec.normalize();

    this.velocity.x = (forward.x * moveVec.y + right.x * moveVec.x) * MOVE_SPEED;
    this.velocity.z = (forward.z * moveVec.y + right.z * moveVec.x) * MOVE_SPEED;

    if (this.input.isDown("Space") && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }
    this.velocity.y += GRAVITY * dt;

    this.moveAndCollide(this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);

    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  // Only ever checks the handful of blocks the player's AABB actually
  // overlaps (at most a few per axis), and each World.getBlock call is
  // O(1) — a chunk-coord hash lookup plus a flat-array index. That's the
  // "청크 단위 공간 분할" the spec asks for; a full octree would add
  // tree-descent overhead without reducing this further, since the grid
  // is already uniform and small per query.
  private collidesAt(x: number, y: number, z: number): boolean {
    const minX = Math.floor(x - HALF_WIDTH);
    const maxX = Math.floor(x + HALF_WIDTH - 1e-6);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT - 1e-6);
    const minZ = Math.floor(z - HALF_WIDTH);
    const maxZ = Math.floor(z + HALF_WIDTH - 1e-6);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (isSolidBlock(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  private moveAndCollide(dx: number, dy: number, dz: number): void {
    this.position.x += dx;
    if (this.collidesAt(this.position.x, this.position.y, this.position.z)) {
      this.position.x -= dx;
    }

    this.position.z += dz;
    if (this.collidesAt(this.position.x, this.position.y, this.position.z)) {
      this.position.z -= dz;
    }

    this.position.y += dy;
    if (this.collidesAt(this.position.x, this.position.y, this.position.z)) {
      this.position.y -= dy;
      if (dy < 0) this.onGround = true;
      this.velocity.y = 0;
    } else if (dy < 0) {
      this.onGround = false;
    }
  }
}
