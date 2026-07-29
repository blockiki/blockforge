import * as THREE from "three";
import { BlockType } from "@blockforge/shared";
import type { World } from "../world/world";
import { raycastVoxels } from "./raycast";

const REACH = 6;

/**
 * Handles aim-highlighting and left-click break / right-click place.
 * Interaction only fires while the pointer is locked (i.e. the player has
 * actually entered the game), so a stray click on the page before that
 * doesn't punch a hole in the world.
 */
export class BlockEditor {
  private readonly highlight: THREE.LineSegments;
  private currentHit: ReturnType<typeof raycastVoxels> = null;

  constructor(
    private readonly world: World,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    scene: THREE.Scene,
    private readonly getSelectedBlock: () => BlockType | null,
    private readonly playerPosition: THREE.Vector3,
    /** Applies the edit locally (prediction) and sends it to the server;
     * injected so this module doesn't need to know about networking. */
    private readonly onEdit: (x: number, y: number, z: number, block: BlockType) => void,
    /** Called with whatever block was just broken, so the caller can add
     * it to the player's inventory. */
    private readonly onBreak: (block: BlockType) => void,
  ) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.highlight = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.highlight.visible = false;
    scene.add(this.highlight);

    this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
    this.domElement.addEventListener("mousedown", (e) => this.handleClick(e));
  }

  update(): void {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    this.currentHit = raycastVoxels(this.world, this.camera.position, direction, REACH);

    if (this.currentHit) {
      this.highlight.visible = true;
      this.highlight.position.set(
        this.currentHit.block.x + 0.5,
        this.currentHit.block.y + 0.5,
        this.currentHit.block.z + 0.5,
      );
    } else {
      this.highlight.visible = false;
    }
  }

  private handleClick(e: MouseEvent): void {
    if (document.pointerLockElement !== this.domElement) return;
    if (!this.currentHit) return;

    if (e.button === 0) {
      const { x, y, z } = this.currentHit.block;
      this.onBreak(this.world.getBlock(x, y, z));
      this.onEdit(x, y, z, BlockType.Air);
    } else if (e.button === 2) {
      const selected = this.getSelectedBlock();
      if (selected === null) return;
      const { x, y, z } = this.currentHit.place;
      if (this.overlapsPlayer(x, y, z)) return;
      this.onEdit(x, y, z, selected);
    }
  }

  private overlapsPlayer(x: number, y: number, z: number): boolean {
    const feetX = Math.floor(this.playerPosition.x);
    const feetZ = Math.floor(this.playerPosition.z);
    const feetY = Math.floor(this.playerPosition.y);
    const headY = Math.floor(this.playerPosition.y + 1.8);
    return x === feetX && z === feetZ && y >= feetY && y <= headY;
  }
}
