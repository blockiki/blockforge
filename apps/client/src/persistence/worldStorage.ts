const DB_NAME = "blockforge";
const DB_VERSION = 1;
const STORE_NAME = "chunkEdits";

/** "lx,ly,lz" -> BlockType, for exactly one chunk. */
export type ChunkEdits = Record<string, number>;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

function chunkRecordKey(seed: number, cx: number, cz: number): string {
  return `${seed}:${cx}:${cz}`;
}

/**
 * World saves are just the player-made diff per chunk, not full block
 * snapshots — terrain regenerates deterministically from the seed, so
 * only deviations from it need to survive a reload.
 */
export async function loadChunkEdits(seed: number, cx: number, cz: number): Promise<ChunkEdits | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(chunkRecordKey(seed, cx, cz));
    request.onsuccess = () => resolve(request.result as ChunkEdits | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChunkEdits(seed: number, cx: number, cz: number, edits: ChunkEdits): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(edits, chunkRecordKey(seed, cx, cz));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
