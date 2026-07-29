import { MAX_HEALTH, MAX_HUNGER, type PlayerSession } from "./playerSession.js";

const HUNGER_DRAIN_PER_SEC = MAX_HUNGER / (5 * 60); // empties over 5 minutes
const STARVATION_DAMAGE_PER_SEC = 2;
const REGEN_HUNGER_THRESHOLD = 50; // only regenerate health while reasonably fed
const REGEN_PER_SEC = 1;

/** Hunger drains over time; once empty it starts costing health instead,
 * and health only regenerates while hunger is comfortably above zero. */
export function tickVitals(session: PlayerSession, dt: number): void {
  session.hunger = Math.max(0, session.hunger - HUNGER_DRAIN_PER_SEC * dt);
  if (session.hunger <= 0) {
    session.health = Math.max(0, session.health - STARVATION_DAMAGE_PER_SEC * dt);
  } else if (session.hunger > REGEN_HUNGER_THRESHOLD && session.health < MAX_HEALTH) {
    session.health = Math.min(MAX_HEALTH, session.health + REGEN_PER_SEC * dt);
  }
}

export function applyDamage(session: PlayerSession, amount: number): void {
  session.health = Math.max(0, session.health - amount);
}
