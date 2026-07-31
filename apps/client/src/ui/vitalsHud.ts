function makeBar(color: string, top: number): { container: HTMLDivElement; fill: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.cssText = `
    position:fixed;left:16px;top:${top}px;width:200px;height:16px;
    background:rgba(0,0,0,0.4);border:1px solid #000;border-radius:3px;
    overflow:hidden;z-index:10;
  `;
  const fill = document.createElement("div");
  fill.style.cssText = `width:100%;height:100%;background:${color};transition:width 0.15s linear;`;
  container.appendChild(fill);
  document.body.appendChild(container);
  return { container, fill };
}

/** Simple health (red) + hunger (orange) bar overlay, driven entirely by
 * the server's playerVitals messages — health/hunger are server state. */
export class VitalsHud {
  private readonly health = makeBar("#d33", 16);
  private readonly hunger = makeBar("#d98a2b", 36);

  update(health: number, hunger: number): void {
    this.health.fill.style.width = `${Math.max(0, Math.min(100, health))}%`;
    this.hunger.fill.style.width = `${Math.max(0, Math.min(100, hunger))}%`;
  }
}
