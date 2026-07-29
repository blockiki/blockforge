import * as THREE from "three";
import type { PlayerInfo, Vec3 } from "@blockforge/shared";

const BODY_WIDTH = 0.6;
const BODY_HEIGHT = 1.8;
// Exponential smoothing rate (per second) for position/rotation
// interpolation: high enough to feel responsive, low enough that the
// ~10Hz playerState updates don't read as jittery snapping.
const LERP_RATE = 10;

interface RemotePlayerVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  nametag: THREE.Sprite;
  targetPosition: THREE.Vector3;
  targetYaw: number;
}

function makeNametagSprite(nickname: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(nickname, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = BODY_HEIGHT + 0.4;
  return sprite;
}

function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Renders other connected players as simple colored boxes + nametag
 * sprites (no character model/skinning system exists yet). Never snaps
 * straight to the latest server-reported position/yaw — it smooths
 * toward it every frame, which is what actually reads as "interpolation"
 * rather than a stutter each time a playerState message arrives.
 */
export class RemotePlayers {
  private readonly players = new Map<string, RemotePlayerVisual>();

  constructor(private readonly scene: THREE.Scene) {}

  add(player: PlayerInfo): void {
    if (this.players.has(player.id)) return;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH),
      new THREE.MeshLambertMaterial({ color: 0x3388ff }),
    );
    body.position.y = BODY_HEIGHT / 2;

    const group = new THREE.Group();
    group.add(body, makeNametagSprite(player.nickname));
    group.position.set(player.position[0], player.position[1], player.position[2]);
    group.rotation.y = player.yaw;
    this.scene.add(group);

    this.players.set(player.id, {
      group,
      body,
      nametag: group.children[1] as THREE.Sprite,
      targetPosition: new THREE.Vector3(...player.position),
      targetYaw: player.yaw,
    });
  }

  remove(playerId: string): void {
    const visual = this.players.get(playerId);
    if (!visual) return;
    this.scene.remove(visual.group);
    visual.body.geometry.dispose();
    (visual.nametag.material as THREE.SpriteMaterial).map?.dispose();
    visual.nametag.material.dispose();
    this.players.delete(playerId);
  }

  updateTarget(playerId: string, position: Vec3, yaw: number): void {
    const visual = this.players.get(playerId);
    if (!visual) return;
    visual.targetPosition.set(position[0], position[1], position[2]);
    visual.targetYaw = yaw;
  }

  /** Call once per frame to smoothly advance every remote player toward its latest known state. */
  update(dt: number): void {
    const t = 1 - Math.exp(-LERP_RATE * dt); // frame-rate independent exponential smoothing
    for (const visual of this.players.values()) {
      visual.group.position.lerp(visual.targetPosition, t);
      visual.group.rotation.y += shortestAngleDelta(visual.group.rotation.y, visual.targetYaw) * t;
    }
  }
}
