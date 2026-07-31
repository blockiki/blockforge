const MAX_LOG_LINES = 8;

/**
 * Minimal chat: Enter opens a text input (no mouse needed, so this
 * works fine while the pointer is locked), Enter again sends, Escape
 * cancels. Movement input must be suppressed elsewhere while open
 * (see main.ts) so typing "w" doesn't also walk the player forward.
 */
export class ChatUI {
  private readonly log: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private open = false;

  constructor(
    private readonly onSend: (text: string) => void,
    private readonly onOpenChange: (open: boolean) => void,
    /** Checked before opening on Enter, so chat doesn't steal focus while
     * another keyboard-driven panel (e.g. crafting) is already open. */
    private readonly canOpen: () => boolean = () => true,
  ) {
    this.log = document.createElement("div");
    this.log.style.cssText = `
      position:fixed;left:16px;bottom:64px;width:360px;max-height:180px;
      display:flex;flex-direction:column;gap:2px;z-index:10;
      font-family:sans-serif;font-size:14px;pointer-events:none;
    `;
    document.body.appendChild(this.log);

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.maxLength = 200;
    this.input.style.cssText = `
      position:fixed;left:16px;bottom:64px;width:360px;padding:6px 8px;
      font-size:14px;border-radius:4px;border:none;display:none;z-index:11;
    `;
    document.body.appendChild(this.input);

    document.addEventListener("keydown", (e) => {
      if (!this.open && this.canOpen() && e.code === "Enter") {
        e.preventDefault();
        this.openInput();
      }
    });
    this.input.addEventListener("keydown", (e) => {
      // Stop typed characters (WASD, Space, ...) from reaching the
      // window-level listeners the movement controller relies on.
      e.stopPropagation();
      if (e.code === "Enter") {
        const text = this.input.value.trim();
        this.closeInput();
        if (text) this.onSend(text);
      } else if (e.code === "Escape") {
        this.closeInput();
      }
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  addMessage(nickname: string, text: string): void {
    const line = document.createElement("div");
    line.textContent = `${nickname}: ${text}`;
    line.style.cssText = "color:#fff;text-shadow:0 0 3px #000,0 0 3px #000;background:rgba(0,0,0,0.35);padding:2px 6px;border-radius:3px;";
    this.log.appendChild(line);
    while (this.log.children.length > MAX_LOG_LINES) {
      this.log.removeChild(this.log.firstChild!);
    }
  }

  addSystemMessage(text: string): void {
    this.addMessage("System", text);
  }

  private openInput(): void {
    this.open = true;
    this.input.value = "";
    this.input.style.display = "block";
    this.input.focus();
    this.onOpenChange(true);
  }

  private closeInput(): void {
    this.open = false;
    this.input.style.display = "none";
    this.input.blur();
    this.onOpenChange(false);
  }
}
