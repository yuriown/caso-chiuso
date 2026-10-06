import { MAZE_X, MAZE_Y, TILE } from './config';
import type { Tile } from './maze';

export interface Vec {
  x: number;
  y: number;
}

export const tileCenter = (t: Tile): Vec => ({ x: MAZE_X + t.x * TILE + TILE / 2, y: MAZE_Y + t.y * TILE + TILE / 2 });
export const toTile = (p: Vec): Tile => ({ x: Math.floor((p.x - MAZE_X) / TILE), y: Math.floor((p.y - MAZE_Y) / TILE) });
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
