import * as THREE from "three";
import type { PlayerInfo } from "@blockforge/shared";
import { World } from "./world/world";
import { InputState } from "./player/input";
import { FirstPersonController } from "./player/controller";
import { BlockEditor } from "./interaction/blockEdit";
import { Hotbar } from "./ui/hotbar";
import { DayNightCycle } from "./time/dayNightCycle";
import { Connection } from "./net/connection";
import { RemotePlayers } from "./net/remotePlayers";

const WS_URL = `ws://${location.hostname}:8090`;
// Chunks within this radius of spawn load synchronously so the player
// never spawns into an empty void; everything beyond streams in
// progressively as World.update() runs each frame.
const SPAWN_WARMUP_RADIUS_CHUNKS = 2;
// How often the local player's position/look is sent to the server.
// Interpolation on the receiving end is what makes this look smooth
// rather than choppy, so this doesn't need to be every frame.
const PLAYER_STATE_SEND_INTERVAL = 0.1;

interface WelcomeInfo {
  playerId: string;
  seed: number;
  players: PlayerInfo[];
}

async function main(): Promise<void> {
  const nickname = await promptNickname();

  const connection = new Connection();
  const welcome = await new Promise<WelcomeInfo>((resolve) => {
    connection.onMessage((message) => {
      if (message.type === "welcome") {
        resolve({ playerId: message.playerId, seed: message.seed, players: message.players });
      }
    });
    connection.connect(WS_URL, nickname).catch((err) => {
      console.error("[main] failed to connect to server", err);
    });
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87ceeb, 20, 120);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // The server is the source of truth for the world seed (architecture
  // principle #1) — the client never picks its own.
  const world = new World(welcome.seed);
  world.onChunkLoaded = (cx, cz) => connection.send({ type: "requestChunkEdits", cx, cz });
  world.loadAreaSync(0, 0, SPAWN_WARMUP_RADIUS_CHUNKS);
  scene.add(world.group);

  const remotePlayers = new RemotePlayers(scene);
  for (const player of welcome.players) remotePlayers.add(player);

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
    (x, y, z, block) => {
      world.setBlock(x, y, z, block); // apply immediately (client-side prediction)
      connection.send({ type: "blockEdit", x, y, z, block }); // server validates + broadcasts, or rejects (reconciliation)
    },
  );

  connection.onMessage((message) => {
    switch (message.type) {
      case "playerJoined":
        remotePlayers.add(message.player);
        break;
      case "playerLeft":
        remotePlayers.remove(message.playerId);
        break;
      case "playerState":
        remotePlayers.updateTarget(message.playerId, message.position, message.yaw);
        break;
      case "blockUpdate":
        world.setBlock(message.x, message.y, message.z, message.block);
        break;
      case "blockEditRejected":
        // Reconciliation: the server didn't accept our optimistic edit
        // (e.g. out of reach) — revert to its authoritative value.
        world.setBlock(message.x, message.y, message.z, message.block);
        break;
      case "chunkEdits":
        world.applyChunkEdits(message.cx, message.cz, message.edits);
        break;
    }
  });

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

  let stateSendTimer = 0;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    // Clamp dt so a tab coming back from the background doesn't apply one
    // huge physics step (e.g. falling through the world).
    const dt = Math.min(clock.getDelta(), 0.1);
    controller.update(dt);
    world.update(controller.position.x, controller.position.z);
    blockEditor.update();
    remotePlayers.update(dt);
    dayNight.update(dt, scene);
    renderer.render(scene, camera);

    stateSendTimer += dt;
    if (stateSendTimer >= PLAYER_STATE_SEND_INTERVAL) {
      stateSendTimer = 0;
      connection.send({
        type: "playerState",
        position: [controller.position.x, controller.position.y, controller.position.z],
        yaw: controller.lookYaw,
        pitch: controller.lookPitch,
      });
    }
  });
}

function promptNickname(): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;inset:0;display:flex;flex-direction:column;gap:14px;
      align-items:center;justify-content:center;background:#111;color:#fff;
      font-family:sans-serif;z-index:30;
    `;

    const label = document.createElement("div");
    label.textContent = "닉네임을 입력하세요";
    label.style.fontSize = "20px";

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 24;
    input.placeholder = "Player";
    input.style.cssText = "font-size:18px;padding:8px 12px;border-radius:4px;border:none;text-align:center;";

    const button = document.createElement("button");
    button.textContent = "입장";
    button.style.cssText = "font-size:16px;padding:8px 20px;border-radius:4px;border:none;cursor:pointer;";

    const submit = () => {
      overlay.remove();
      resolve(input.value.trim() || "Player");
    };
    button.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    overlay.append(label, input, button);
    document.body.appendChild(overlay);
    input.focus();
  });
}

main().catch((err) => {
  console.error("[main] failed to start", err);
});
