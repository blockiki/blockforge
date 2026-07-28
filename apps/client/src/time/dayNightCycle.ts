import * as THREE from "three";

const DAY_COLOR = new THREE.Color(0x87ceeb);
const NIGHT_COLOR = new THREE.Color(0x0a0a1a);

/**
 * Drives a directional "sun" light and ambient fill light around a full
 * day/night cycle. Kept deliberately short (2 minutes) for a demo so the
 * lighting change is easy to observe without waiting.
 */
export class DayNightCycle {
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.HemisphereLight;
  private elapsed = 0;

  constructor(
    scene: THREE.Scene,
    private readonly cycleDurationSeconds = 120,
  ) {
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(this.sun, this.ambient);
  }

  update(dt: number, scene: THREE.Scene): void {
    this.elapsed = (this.elapsed + dt) % this.cycleDurationSeconds;
    const angle = (this.elapsed / this.cycleDurationSeconds) * Math.PI * 2;
    const sunHeight = Math.sin(angle);

    this.sun.position.set(Math.cos(angle) * 100, sunHeight * 100 + 20, 50);
    this.sun.intensity = Math.max(0, sunHeight) * 1.2;

    // Blend day/night sky and ambient light smoothly across the horizon
    // rather than snapping, so sunrise/sunset reads as a transition.
    const blend = THREE.MathUtils.clamp((sunHeight + 0.2) / 1.2, 0, 1);
    const skyColor = NIGHT_COLOR.clone().lerp(DAY_COLOR, blend);
    scene.background = skyColor;
    if (scene.fog) scene.fog.color = skyColor;
    this.ambient.intensity = 0.15 + blend * 0.5;
  }
}
