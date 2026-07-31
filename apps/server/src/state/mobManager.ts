import { randomUUID } from "node:crypto";
import { MobKind, type MobInfo } from "@blockforge/shared";
import type { PlayerSession } from "./playerSession.js";

const MOB_CAP = 10;
const SPAWN_INTERVAL_SEC = 6;
const SPAWN_MIN_DIST = 8;
const SPAWN_MAX_DIST = 16;
const CHASE_RADIUS = 12; // start chasing a player within this range
const DESPAWN_RADIUS = 40; // no player within this range at all -> eligible to despawn
const DESPAWN_AFTER_SEC = 30;
const CHASE_SPEED = 2.2; // blocks/sec — slower than the player's 5, so it's escapable
const WANDER_SPEED = 1.0;
const CONTACT_RANGE = 1.2;
const CONTACT_DAMAGE = 8;
const CONTACT_COOLDOWN_SEC = 1.2;

interface Mob {
  id: string;
  kind: MobKind;
  position: [number, number, number];
  yaw: number;
  wanderTarget: [number, number] | null;
  lastContactAt: number;
  farSince: number | null;
}

export interface MobDamageEvent {
  playerId: string;
  amount: number;
}

export interface MobTickResult {
  spawned: MobInfo[];
  states: MobInfo[];
  removed: string[];
  damage: MobDamageEvent[];
}

function distanceXZ(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dz);
}

/**
 * Server-authoritative mob AI: wander when no player is close, chase the
 * nearest one within CHASE_RADIUS, and deal contact damage on touch.
 * Mobs snap to the terrain surface each tick via getSurfaceHeight instead
 * of simulating real gravity/collision — a deliberate simplification,
 * since full AABB physics for every mob isn't needed for wander/chase.
 */
export class MobManager {
  private readonly mobs = new Map<string, Mob>();
  private elapsed = 0;
  private timeSinceSpawn = 0;

  constructor(private readonly getSurfaceHeight: (x: number, z: number) => number) {}

  private toInfo(mob: Mob): MobInfo {
    return { id: mob.id, kind: mob.kind, position: mob.position, yaw: mob.yaw };
  }

  tick(dt: number, sessions: PlayerSession[]): MobTickResult {
    this.elapsed += dt;
    const spawned: MobInfo[] = [];
    const removed: string[] = [];
    const damage: MobDamageEvent[] = [];

    this.timeSinceSpawn += dt;
    if (this.timeSinceSpawn >= SPAWN_INTERVAL_SEC && this.mobs.size < MOB_CAP && sessions.length > 0) {
      this.timeSinceSpawn = 0;
      const mob = this.spawnNear(sessions[Math.floor(Math.random() * sessions.length)]);
      spawned.push(this.toInfo(mob));
    }

    for (const mob of this.mobs.values()) {
      let nearest: PlayerSession | null = null;
      let nearestDist = Infinity;
      for (const session of sessions) {
        const d = distanceXZ(session.position, mob.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = session;
        }
      }

      if (nearest && nearestDist <= CHASE_RADIUS) {
        this.moveToward(mob, nearest.position[0], nearest.position[2], CHASE_SPEED, dt);
      } else {
        this.wander(mob, dt);
      }
      mob.position[1] = this.getSurfaceHeight(Math.round(mob.position[0]), Math.round(mob.position[2])) + 1;

      if (!nearest || nearestDist > DESPAWN_RADIUS) {
        if (mob.farSince === null) mob.farSince = this.elapsed;
      } else {
        mob.farSince = null;
      }

      if (nearest && nearestDist <= CONTACT_RANGE && this.elapsed - mob.lastContactAt >= CONTACT_COOLDOWN_SEC) {
        mob.lastContactAt = this.elapsed;
        damage.push({ playerId: nearest.id, amount: CONTACT_DAMAGE });
      }

      if (mob.farSince !== null && this.elapsed - mob.farSince >= DESPAWN_AFTER_SEC) {
        removed.push(mob.id);
      }
    }

    for (const id of removed) this.mobs.delete(id);
    const states = [...this.mobs.values()].map((m) => this.toInfo(m));

    return { spawned, states, removed, damage };
  }

  private spawnNear(anchor: PlayerSession): Mob {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
    const x = Math.round(anchor.position[0] + Math.cos(angle) * dist);
    const z = Math.round(anchor.position[2] + Math.sin(angle) * dist);
    const mob: Mob = {
      id: randomUUID(),
      kind: MobKind.Crawler,
      position: [x, this.getSurfaceHeight(x, z) + 1, z],
      yaw: 0,
      wanderTarget: null,
      lastContactAt: -Infinity,
      farSince: null,
    };
    this.mobs.set(mob.id, mob);
    return mob;
  }

  private moveToward(mob: Mob, targetX: number, targetZ: number, speed: number, dt: number): void {
    const dx = targetX - mob.position[0];
    const dz = targetZ - mob.position[2];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    const nx = dx / len;
    const nz = dz / len;
    mob.position[0] += nx * speed * dt;
    mob.position[2] += nz * speed * dt;
    // Matches the client camera's yaw convention (forward = (0,0,-1)
    // rotated by yaw around Y) so the mob's box visually faces its
    // movement direction instead of an arbitrary/wrong way.
    mob.yaw = Math.atan2(-nx, -nz);
  }

  private wander(mob: Mob, dt: number): void {
    if (!mob.wanderTarget || Math.hypot(mob.wanderTarget[0] - mob.position[0], mob.wanderTarget[1] - mob.position[2]) < 0.5) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 5;
      mob.wanderTarget = [mob.position[0] + Math.cos(angle) * dist, mob.position[2] + Math.sin(angle) * dist];
    }
    this.moveToward(mob, mob.wanderTarget[0], mob.wanderTarget[1], WANDER_SPEED, dt);
  }
}
