import { BLOCK_COLORS, BlockType } from "@blockforge/shared";

const SLOT_BLOCKS: readonly (BlockType | null)[] = [
  BlockType.Grass,
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Sand,
  BlockType.Wood,
  null,
  null,
  null,
  null,
];

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** 9-slot hotbar overlay: number keys 1-9 or mouse wheel to select. */
export class Hotbar {
  private selectedIndex = 0;
  private readonly slotElements: HTMLDivElement[] = [];

  constructor() {
    const bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:4px;z-index:10;font-family:sans-serif;";

    SLOT_BLOCKS.forEach((block, i) => {
      const slot = document.createElement("div");
      slot.style.cssText = `
        width:48px;height:48px;box-sizing:border-box;border:2px solid #444;
        background:${block !== null ? toHexColor(BLOCK_COLORS[block]) : "rgba(255,255,255,0.08)"};
        display:flex;align-items:flex-end;justify-content:flex-end;
        color:#fff;font-size:11px;padding:2px;text-shadow:0 0 2px #000;
      `;
      slot.textContent = String(i + 1);
      bar.appendChild(slot);
      this.slotElements.push(slot);
    });

    document.body.appendChild(bar);
    this.refreshHighlight();

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
}
