/** Mob kind registry — same pattern as BlockType, so client and server
 * always agree on what a mob ID means. Only one kind for now; more can
 * be added here without touching the protocol shape. */
export const MobKind = {
  Crawler: 0,
} as const;

export type MobKind = (typeof MobKind)[keyof typeof MobKind];

export interface MobInfo {
  id: string;
  kind: MobKind;
  position: readonly [number, number, number];
  yaw: number;
}
