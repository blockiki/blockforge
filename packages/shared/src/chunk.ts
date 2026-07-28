/**
 * Chunk dimensions shared by world generation, meshing, and networking.
 * Both apps must agree on these so chunk coordinates and serialized
 * block arrays line up exactly.
 */
export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 256;

export const BLOCKS_PER_CHUNK = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
