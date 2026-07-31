interface Slide {
  title: string;
  text: string;
  render: (stage: HTMLDivElement) => void;
}

const STYLE_ID = "bf-help-styles";

function injectStylesOnce(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes bf-key-pulse {
      0%, 20% { background:#fff; color:#111; transform:scale(1.15); }
      30%, 100% { background:#333; color:#aaa; transform:scale(1); }
    }
    @keyframes bf-walk-dot {
      0%, 100% { transform:translateX(-36px); }
      50% { transform:translateX(36px); }
    }
    @keyframes bf-look-spin {
      from { transform:rotate(0deg); }
      to { transform:rotate(360deg); }
    }
    @keyframes bf-block-break {
      0%, 55% { opacity:1; transform:scale(1) rotate(0deg); }
      70% { opacity:0.3; transform:scale(0.6) rotate(12deg); }
      85%, 100% { opacity:1; transform:scale(1) rotate(0deg); }
    }
    @keyframes bf-block-place {
      0%, 45% { opacity:0; transform:scale(0.4); }
      70%, 100% { opacity:1; transform:scale(1); }
    }
    @keyframes bf-craft-in {
      0%, 45% { opacity:1; transform:translateY(0); }
      55%, 100% { opacity:0; transform:translateY(-8px); }
    }
    @keyframes bf-craft-out {
      0%, 45% { opacity:0; transform:translateY(8px) scale(0.8); }
      65%, 100% { opacity:1; transform:translateY(0) scale(1); }
    }
    @keyframes bf-bar-drain {
      0% { width:95%; }
      45% { width:25%; }
      55% { width:25%; }
      100% { width:95%; }
    }
    @keyframes bf-mob-wander {
      0%, 100% { transform:translateX(-40px); }
      40% { transform:translateX(30px); }
      55% { transform:translateX(30px); }
      90% { transform:translateX(-40px); }
    }
    @keyframes bf-bubble-pop {
      0%, 15% { opacity:0; transform:translateY(6px) scale(0.85); }
      30%, 70% { opacity:1; transform:translateY(0) scale(1); }
      85%, 100% { opacity:0; transform:translateY(-6px) scale(0.9); }
    }
  `;
  document.head.appendChild(style);
}

function el(tag: string, cssText: string, text?: string): HTMLDivElement {
  const node = document.createElement(tag) as HTMLDivElement;
  node.style.cssText = cssText;
  if (text !== undefined) node.textContent = text;
  return node;
}

function keycap(label: string, delaySec: number): HTMLDivElement {
  return el(
    "div",
    `width:28px;height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;
     font-family:sans-serif;font-size:13px;font-weight:bold;background:#333;color:#aaa;
     animation:bf-key-pulse 2s ${delaySec}s infinite;`,
    label,
  );
}

function renderMovementStage(stage: HTMLDivElement): void {
  const keys = el("div", "display:flex;flex-direction:column;align-items:center;gap:4px;");
  keys.appendChild(keycap("W", 0));
  const row = el("div", "display:flex;gap:4px;");
  row.append(keycap("A", 0.5), keycap("S", 1.0), keycap("D", 1.5));
  keys.appendChild(row);

  const track = el(
    "div",
    "position:relative;width:120px;height:16px;margin-top:12px;border-bottom:2px solid #555;",
  );
  track.appendChild(
    el(
      "div",
      "position:absolute;left:50%;top:0;width:14px;height:14px;border-radius:50%;background:#4caf50;animation:bf-walk-dot 2s ease-in-out infinite;margin-left:-7px;",
    ),
  );

  const eye = el(
    "div",
    "width:26px;height:26px;border:3px solid #7ab8ff;border-top-color:transparent;border-radius:50%;margin-top:14px;animation:bf-look-spin 1.6s linear infinite;",
  );

  const wrap = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px;");
  wrap.append(keys, track, eye);
  stage.appendChild(wrap);
}

function renderBlockEditStage(stage: HTMLDivElement): void {
  const wrap = el("div", "display:flex;gap:28px;align-items:center;");

  const breakCol = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px;");
  breakCol.appendChild(
    el(
      "div",
      "width:40px;height:40px;background:#8a8a8a;border:2px solid #555;animation:bf-block-break 2.4s ease-in-out infinite;",
    ),
  );
  breakCol.appendChild(el("div", "font-family:sans-serif;font-size:12px;color:#ccc;", "좌클릭: 파괴"));

  const placeCol = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px;");
  placeCol.appendChild(
    el(
      "div",
      "width:40px;height:40px;background:#4caf50;border:2px solid #2e7d32;animation:bf-block-place 2.4s ease-in-out infinite;",
    ),
  );
  placeCol.appendChild(el("div", "font-family:sans-serif;font-size:12px;color:#ccc;", "우클릭: 설치"));

  wrap.append(breakCol, placeCol);
  stage.appendChild(wrap);
}

function renderCraftingStage(stage: HTMLDivElement): void {
  const container = el("div", "position:relative;width:160px;height:60px;");
  container.appendChild(
    el(
      "div",
      "position:absolute;left:20px;top:14px;width:44px;height:32px;background:#6d4c25;border:2px solid #4a3319;animation:bf-craft-in 2.6s ease-in-out infinite;",
    ),
  );
  const planksWrap = el(
    "div",
    "position:absolute;right:8px;top:8px;display:grid;grid-template-columns:1fr 1fr;gap:3px;animation:bf-craft-out 2.6s ease-in-out infinite;",
  );
  for (let i = 0; i < 4; i++) {
    planksWrap.appendChild(el("div", "width:20px;height:20px;background:#ba8a52;border:1px solid #8a6535;"));
  }
  container.append(planksWrap);
  stage.appendChild(container);
}

function renderVitalsStage(stage: HTMLDivElement): void {
  const wrap = el("div", "display:flex;flex-direction:column;gap:10px;width:160px;");
  const makeBar = (color: string, label: string, delay: number) => {
    const row = el("div", "display:flex;flex-direction:column;gap:2px;");
    row.appendChild(el("div", "font-family:sans-serif;font-size:11px;color:#ccc;", label));
    const track = el("div", "width:100%;height:14px;background:rgba(255,255,255,0.15);border-radius:3px;overflow:hidden;");
    track.appendChild(el("div", `height:100%;background:${color};animation:bf-bar-drain 3s ease-in-out ${delay}s infinite;`));
    row.appendChild(track);
    return row;
  };
  wrap.append(makeBar("#d33", "체력", 0), makeBar("#d98a2b", "허기", 0.3));
  stage.appendChild(wrap);
}

function renderMobStage(stage: HTMLDivElement): void {
  const track = el("div", "position:relative;width:140px;height:40px;");
  track.appendChild(
    el(
      "div",
      "position:absolute;left:50%;top:4px;width:26px;height:34px;background:#3388ff;margin-left:-13px;",
    ),
  );
  track.appendChild(
    el(
      "div",
      "position:absolute;left:50%;top:8px;width:20px;height:26px;background:#7a1f3d;margin-left:-10px;animation:bf-mob-wander 3s ease-in-out infinite;",
    ),
  );
  stage.appendChild(track);
}

function renderMultiplayerStage(stage: HTMLDivElement): void {
  const wrap = el("div", "position:relative;display:flex;gap:24px;align-items:flex-end;");

  const meCol = el("div", "position:relative;display:flex;flex-direction:column;align-items:center;");
  const bubble = el(
    "div",
    "position:absolute;top:-26px;background:#fff;color:#111;font-family:sans-serif;font-size:11px;padding:3px 6px;border-radius:6px;animation:bf-bubble-pop 3s ease-in-out infinite;",
    "안녕!",
  );
  meCol.append(bubble, el("div", "width:22px;height:30px;background:#4caf50;"));

  const otherCol = el("div", "display:flex;flex-direction:column;align-items:center;gap:4px;");
  otherCol.append(
    el("div", "width:22px;height:30px;background:#3388ff;"),
    el("div", "font-family:sans-serif;font-size:11px;color:#ccc;", "Player"),
  );

  wrap.append(meCol, otherCol);
  stage.appendChild(wrap);
}

const SLIDES: readonly Slide[] = [
  {
    title: "이동 & 시점",
    text: "W A S D로 이동하고 마우스로 시점을 돌립니다. 스페이스바로 점프할 수 있어요.",
    render: renderMovementStage,
  },
  {
    title: "블록 파괴 / 설치",
    text: "좌클릭으로 블록을 파괴하고 우클릭으로 설치합니다. 화면 아래 핫바에서 숫자키(1-9)나 마우스 휠로 블록을 고르세요.",
    render: renderBlockEditStage,
  },
  {
    title: "자원 획득 & 제작",
    text: "블록을 파괴하면 인벤토리에 쌓입니다. E 키로 제작창을 열고 Enter로 제작하세요. 예: 나무 1개 → 목재 4개.",
    render: renderCraftingStage,
  },
  {
    title: "체력 & 허기",
    text: "화면 왼쪽 위 빨간 바는 체력, 주황 바는 허기입니다. 허기가 바닥나면 체력이 서서히 줄고, 체력이 0이 되면 스폰 지점에서 다시 시작해요.",
    render: renderVitalsStage,
  },
  {
    title: "위험한 몹",
    text: "가끔 몹이 나타나 배회하거나 플레이어를 쫓아옵니다. 가까이 닿으면 피해를 입으니 거리를 두세요.",
    render: renderMobStage,
  },
  {
    title: "멀티플레이 & 채팅",
    text: "다른 플레이어는 파란 상자와 닉네임으로 보입니다. Enter로 채팅을 입력하고 다시 Enter로 전송하세요.",
    render: renderMultiplayerStage,
  },
];

/**
 * "?" button (conventional top-right placement) opens a slide-by-slide
 * how-to-play tutorial — each slide pairs a short looping CSS animation
 * (no external image/video assets, consistent with the rest of the
 * project's procedural-only approach) with a text explanation.
 */
export class HelpModal {
  private readonly backdrop: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly textEl: HTMLDivElement;
  private readonly dots: HTMLDivElement[] = [];
  private open = false;
  private index = 0;

  constructor(private readonly onOpenChange: (open: boolean) => void) {
    injectStylesOnce();

    const button = el(
      "div",
      `position:fixed;top:16px;right:16px;width:40px;height:40px;border-radius:50%;
       background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;
       font-family:sans-serif;font-size:20px;font-weight:bold;cursor:pointer;z-index:40;user-select:none;`,
      "?",
    );
    button.addEventListener("click", () => this.openModal());
    document.body.appendChild(button);

    this.backdrop = el(
      "div",
      `position:fixed;inset:0;display:none;align-items:center;justify-content:center;
       background:rgba(0,0,0,0.65);z-index:41;font-family:sans-serif;`,
    );

    const dialog = el(
      "div",
      `width:480px;max-width:90vw;background:#1b1b1f;color:#fff;border-radius:10px;
       padding:24px;display:flex;flex-direction:column;align-items:center;gap:14px;position:relative;`,
    );

    const closeButton = el(
      "div",
      "position:absolute;right:14px;top:10px;cursor:pointer;font-size:18px;color:#999;",
      "×",
    );
    closeButton.addEventListener("click", () => this.close());

    this.titleEl = el("div", "font-size:18px;font-weight:bold;");
    this.stage = el(
      "div",
      "width:100%;height:140px;display:flex;align-items:center;justify-content:center;background:#111;border-radius:8px;",
    );
    this.textEl = el("div", "font-size:14px;line-height:1.5;color:#ddd;text-align:center;min-height:42px;");

    const nav = el("div", "display:flex;align-items:center;gap:16px;");
    const prevButton = el(
      "div",
      "cursor:pointer;font-size:20px;padding:4px 10px;border-radius:4px;background:#2a2a30;",
      "‹",
    );
    const dotsRow = el("div", "display:flex;gap:6px;");
    SLIDES.forEach((_, i) => {
      const dot = el(
        "div",
        "width:8px;height:8px;border-radius:50%;background:#fff;opacity:0.4;cursor:pointer;",
      );
      dot.addEventListener("click", () => this.goTo(i));
      dotsRow.appendChild(dot);
      this.dots.push(dot);
    });
    const nextButton = el(
      "div",
      "cursor:pointer;font-size:20px;padding:4px 10px;border-radius:4px;background:#2a2a30;",
      "›",
    );
    prevButton.addEventListener("click", () => this.prev());
    nextButton.addEventListener("click", () => this.next());
    nav.append(prevButton, dotsRow, nextButton);

    dialog.append(closeButton, this.titleEl, this.stage, this.textEl, nav);
    this.backdrop.appendChild(dialog);
    document.body.appendChild(this.backdrop);

    document.addEventListener("keydown", (e) => {
      if (!this.open) return;
      if (e.code === "Escape") this.close();
      else if (e.code === "ArrowRight") this.next();
      else if (e.code === "ArrowLeft") this.prev();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  private openModal(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.open = true;
    this.index = 0;
    this.backdrop.style.display = "flex";
    this.renderSlide();
    this.onOpenChange(true);
  }

  private close(): void {
    this.open = false;
    this.backdrop.style.display = "none";
    this.onOpenChange(false);
  }

  private next(): void {
    this.goTo((this.index + 1) % SLIDES.length);
  }

  private prev(): void {
    this.goTo((this.index - 1 + SLIDES.length) % SLIDES.length);
  }

  private goTo(i: number): void {
    this.index = i;
    this.renderSlide();
  }

  private renderSlide(): void {
    const slide = SLIDES[this.index];
    this.titleEl.textContent = slide.title;
    this.textEl.textContent = slide.text;
    this.stage.innerHTML = "";
    slide.render(this.stage);
    this.dots.forEach((dot, i) => {
      dot.style.opacity = i === this.index ? "1" : "0.4";
    });
  }
}
