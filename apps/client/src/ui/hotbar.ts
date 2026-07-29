import { BLOCK_COLORS, BlockType } from "@blockforge/shared";
import type { Inventory } from "../inventory/inventory";

const SLOT_BLOCKS: readonly (BlockType | null)[] = [
  BlockType.Grass,
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Sand,
  BlockType.Wood,
  BlockType.Planks,
  null,
  null,
  null,
];

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * 9-slot hotbar overlay: number keys 1-9 or mouse wheel to select.
 * Each slot shows how many of that block the player is currently
 * carrying (Inventory) — placing one decrements the count, and a slot
 * at 0 can still be selected but won't place anything (blockEdit.ts
 * treats a zero-count selection the same as an empty slot).
 */
export class Hotbar {
  private selectedIndex = 0;
  private readonly slotElements: HTMLDivElement[] = [];
  private readonly countElements: HTMLDivElement[] = [];

  constructor(private readonly inventory: Inventory) {
    const bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:4px;z-index:10;font-family:sans-serif;";

    SLOT_BLOCKS.forEach((block, i) => {
      const slot = document.createElement("div");
      slot.style.cssText = `
        width:48px;height:48px;box-sizing:border-box;border:2px solid #444;position:relative;
        background:${block !== null ? toHexColor(BLOCK_COLORS[block]) : "rgba(255,255,255,0.08)"};
      `;
      const slotNumber = document.createElement("div");
      slotNumber.textContent = String(i + 1);
      slotNumber.style.cssText = "position:absolute;right:2px;top:1px;color:#fff;font-size:11px;text-shadow:0 0 2px #000;";
      slot.appendChild(slotNumber);

      const count = document.createElement("div");
      count.style.cssText = "position:absolute;left:2px;bottom:1px;color:#fff;font-size:12px;font-weight:bold;text-shadow:0 0 2px #000;";
      slot.appendChild(count);
      this.countElements.push(count);

      bar.appendChild(slot);
      this.slotElements.push(slot);
    });

    document.body.appendChild(bar);
    this.refreshCounts();
    this.refreshHighlight();
    inventory.onChange(() => this.refreshCounts());

    window.addEventListener("keydown", (e) => {
      const match = /^Digit([1-9])$/.exec(e.code);
      if (match) this.select(Number(match[1]) - 1);
    });
    window.addEventListener("wheel", (e) => {
      const direction = e.deltaY > 0 ? 1 : -1;
      this.select((this.selectedIndex + direction + SLOT_BLOCKS.length) % SLOT_BLOCKS.length);
    });
  }

  getSelectedBlock(): BlockType | null {
    return SLOT_BLOCKS[this.selectedIndex];
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.refreshHighlight();
  }

  private refreshHighlight(): void {
    this.slotElements.forEach((el, i) => {
      const active = i === this.selectedIndex;
      el.style.borderColor = active ? "#ffffff" : "#444444";
      el.style.boxShadow = active ? "0 0 6px #ffffff" : "none";
    });
  }

  private refreshCounts(): void {
    SLOT_BLOCKS.forEach((block, i) => {
      this.countElements[i].textContent = block !== null ? String(this.inventory.getCount(block)) : "";
    });
  }
}
