import { describe, expect, it } from 'vitest';
import { findPath, generateMaze } from './maze';
import { CELLS_H, CELLS_W } from './config';

describe('generateMaze', () => {
  it('sempre tem caminho do inicio ate a saida', () => {
    for (let i = 0; i < 300; i++) {
      const maze = generateMaze(CELLS_W, CELLS_H);
      const path = findPath(maze, maze.start, maze.exit);
      expect(path).not.toBeNull();
      expect(path!.at(-1)).toEqual(maze.exit);
    }
  });

  it('borda e fechada, exceto pela saida', () => {
    const maze = generateMaze(CELLS_W, CELLS_H);
    for (let x = 0; x < maze.w; x++) {
      expect(maze.grid[maze.h - 1][x]).toBe(true);
      if (x !== maze.exit.x) expect(maze.grid[0][x]).toBe(true);
    }
    for (let y = 0; y < maze.h; y++) {
      expect(maze.grid[y][0]).toBe(true);
      expect(maze.grid[y][maze.w - 1]).toBe(true);
    }
  });
});
