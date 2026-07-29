import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "world");

function chunkFilePath(seed: number, cx: number, cz: number): string {
  return join(DATA_ROOT, String(seed), `${cx}_${cz}.json`);
}

/**
 * World saves are just the player-made diff per chunk, not full block
 * snapshots — terrain regenerates deterministically from the seed (see
 * packages/shared's TerrainGenerator), so only deviations from it need
 * to survive a restart. One JSON file per chunk keeps this simple and
 * avoids any database dependency for the demo.
 */
export async function loadChunkEdits(seed: number, cx: number, cz: number): Promise<Record<string, number> | undefined> {
  try {
    const raw = await readFile(chunkFilePath(seed, cx, cz), "utf-8");
    return JSON.parse(raw) as Record<string, number>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export async function saveChunkEdits(seed: number, cx: number, cz: number, edits: Record<string, number>): Promise<void> {
  const filePath = chunkFilePath(seed, cx, cz);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(edits), "utf-8");
}
