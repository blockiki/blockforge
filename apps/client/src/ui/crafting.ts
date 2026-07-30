import { BlockType } from "@blockforge/shared";
import type { Inventory } from "../inventory/inventory";

interface Recipe {
  input: BlockType;
  inputCount: number;
  output: BlockType;
  outputCount: number;
  label: string;
}

const RECIPES: readonly Recipe[] = [
  { input: BlockType.Wood, inputCount: 1, output: BlockType.Planks, outputCount: 4, label: "나무 1개 → 목재 4개" },
];

/**
 * Keyboard-only crafting panel (E to toggle, Enter to craft, Escape to
 * close) — deliberately avoids needing the mouse cursor, so it works
 * the same whether or not the pointer is locked, with just one recipe
 * for now. Movement input must be suppressed elsewhere while open (see
 * main.ts), same as ChatUI.
 */
export class CraftingUI {
  private readonly panel: HTMLDivElement;
  private readonly rows: HTMLDivElement[] = [];
  private open = false;

  constructor(
    private readonly inventory: Inventory,
    private readonly onOpenChange: (open: boolean) => void,
    /** Checked before toggling open on E, so it doesn't pop up behind
     * the help modal while that's showing. */
    private readonly canOpen: () => boolean = () => true,
  ) {
    this.panel = document.createElement("div");
    this.panel.style.cssText = `
      position:fixed;right:16px;top:72px;width:280px;padding:12px;
      background:rgba(0,0,0,0.7);color:#fff;font-family:sans-serif;
      font-size:14px;border-radius:6px;display:none;z-index:15;
    `;
    const title = document.createElement("div");
    title.textContent = "제작 (E로 닫기, Enter로 제작)";
    title.style.cssText = "margin-bottom:8px;font-weight:bold;";
    this.panel.appendChild(title);

    for (const recipe of RECIPES) {
      const row = document.createElement("div");
      row.style.cssText = "padding:4px 0;";
      this.panel.appendChild(row);
      this.rows.push(row);
    }
    document.body.appendChild(this.panel);

    inventory.onChange(() => this.refresh());

    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyE") {
        if (!this.open && !this.canOpen()) return;
        e.preventDefault();
        this.toggle();
        return;
      }
      if (!this.open) return;
      if (e.code === "Escape") {
        this.close();
      } else if (e.code === "Enter") {
        this.craft(RECIPES[0]);
      }
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  private toggle(): void {
    if (this.open) this.close();
    else this.openPanel();
  }

  private openPanel(): void {
    this.open = true;
    this.panel.style.display = "block";
    this.refresh();
    this.onOpenChange(true);
  }

  private close(): void {
    this.open = false;
    this.panel.style.display = "none";
    this.onOpenChange(false);
  }

  private craft(recipe: Recipe): void {
    if (this.inventory.remove(recipe.input, recipe.inputCount)) {
      this.inventory.add(recipe.output, recipe.outputCount);
    }
  }

  private refresh(): void {
    RECIPES.forEach((recipe, i) => {
      const have = this.inventory.getCount(recipe.input);
      const enough = have >= recipe.inputCount;
      this.rows[i].style.opacity = enough ? "1" : "0.5";
      this.rows[i].textContent = `${recipe.label} (보유: ${have})`;
    });
  }
}
