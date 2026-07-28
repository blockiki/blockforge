import * as THREE from "three";
import { World } from "./world/world";
import { InputState } from "./player/input";
import { FirstPersonController } from "./player/controller";
import { BlockEditor } from "./interaction/blockEdit";
import { Hotbar } from "./ui/hotbar";
import { DayNightCycle } from "./time/dayNightCycle";

const WORLD_SEED = 1337;
// Fixed-size world for Phase 1 (7x7 chunks); dynamic chunk streaming as the
// player roams is Phase 2.
const WORLD_RADIUS_CHUNKS = 3;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 20, 120);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const world = new World(WORLD_SEED);
world.generateFixedArea(WORLD_RADIUS_CHUNKS);
scene.add(world.group);

const dayNight = new DayNightCycle(scene);

const input = new InputState();
const controller = new FirstPersonController(camera, renderer.domElement, world, input);
const spawnY = world.surfaceHeightAt(0, 0) + 1;
controller.spawnAt(0.5, spawnY, 0.5);

const hotbar = new Hotbar();
const blockEditor = new BlockEditor(
  world,
  camera,
  renderer.domElement,
  scene,
  () => hotbar.getSelectedBlock(),
  controller.position,
);

const overlay = document.createElement("div");
overlay.textContent = "클릭하여 시작 — WASD 이동, 마우스 시점, 스페이스 점프, 좌클릭 파괴, 우클릭 설치";
overlay.style.cssText = `
  position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  color:#fff;background:rgba(0,0,0,0.55);font-family:sans-serif;font-size:20px;
  cursor:pointer;z-index:20;text-align:center;padding:20px;
`;
document.body.appendChild(overlay);
overlay.addEventListener("click", () => renderer.domElement.requestPointerLock());
document.addEventListener("pointerlockchange", () => {
  overlay.style.display = document.pointerLockElement === renderer.domElement ? "none" : "flex";
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  // Clamp dt so a tab coming back from the background doesn't apply one
  // huge physics step (e.g. falling through the world).
  const dt = Math.min(clock.getDelta(), 0.1);
  controller.update(dt);
  blockEditor.update();
  dayNight.update(dt, scene);
  renderer.render(scene, camera);
});
