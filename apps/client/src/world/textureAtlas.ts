import * as THREE from "three";
import { BLOCK_COLORS, BlockType } from "@blockforge/shared";

const TILE_SIZE = 16;

// Every non-air block gets one tile; order only has to be stable, not
// meaningful. Adding a new BlockType later just means adding it here.
const TILE_ORDER: readonly BlockType[] = [
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Grass,
  BlockType.Wood,
  BlockType.Sand,
  BlockType.Snow,
];

export interface TileUV {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

function shade(color: number, amount: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp(((color >> 16) & 0xff) + amount);
  const g = clamp(((color >> 8) & 0xff) + amount);
  const b = clamp((color & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function drawTile(ctx: CanvasRenderingContext2D, tileX: number, block: BlockType): void {
  const base = BLOCK_COLORS[block];
  ctx.fillStyle = shade(base, 0);
  ctx.fillRect(tileX, 0, TILE_SIZE, TILE_SIZE);

  if (block === BlockType.Wood) {
    // Bark: vertical streaks instead of speckle reads as wood grain.
    ctx.fillStyle = shade(base, -35);
    for (let x = tileX + 1; x < tileX + TILE_SIZE; x += 3) {
      ctx.fillRect(x, 0, 1, TILE_SIZE);
    }
    return;
  }

  const speckleAmount = block === BlockType.Sand || block === BlockType.Snow ? 22 : -30;
  ctx.fillStyle = shade(base, speckleAmount);
  for (let i = 0; i < 16; i++) {
    const x = tileX + Math.floor(Math.random() * TILE_SIZE);
    const y = Math.floor(Math.random() * TILE_SIZE);
    ctx.fillRect(x, y, 1, 1);
  }
}

/**
 * Builds a single-row procedural texture atlas (one 16x16 tile per block
 * type, drawn with plain Canvas2D) so blocks read as more than flat color
 * without shipping any external image assets. NearestFilter keeps tiles
 * crisp/blocky instead of blurring at this low resolution.
 */
export function buildTextureAtlas(): { texture: THREE.Texture; getTileUV: (block: BlockType) => TileUV } {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * TILE_ORDER.length;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;

  const tileIndexByBlock = new Map<BlockType, number>();
  TILE_ORDER.forEach((block, i) => {
    tileIndexByBlock.set(block, i);
    drawTile(ctx, i * TILE_SIZE, block);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const tileCount = TILE_ORDER.length;
  function getTileUV(block: BlockType): TileUV {
    const index = tileIndexByBlock.get(block) ?? 0;
    return { u0: index / tileCount, v0: 0, u1: (index + 1) / tileCount, v1: 1 };
  }

  return { texture, getTileUV };
}
