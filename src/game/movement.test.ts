import { describe, expect, it } from 'vitest';
import { BanditAI, IncomingBook } from './ai';
import { BANDIT_HALF, BANDIT_SPEED, CELLS_H, CELLS_W } from './config';
import { generateMaze, isOpen } from './maze';
import { blocked, moveHuman, reachedExit, stepToward } from './movement';
import { Vec, tileCenter, toTile } from './geometry';

function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inWall = (maze: ReturnType<typeof generateMaze>, p: Vec) => {
  const t = toTile(p);
  return !isOpen(maze, t.x, t.y);
};

describe('o fugitivo nunca atravessa parede', () => {
  it('jogador: teclas e diagonais aleatorias, com quadros de duracao variada', () => {
    const rng = seeded(11);
    let problems = 0;
    for (let m = 0; m < 200; m++) {
      const maze = generateMaze(CELLS_W, CELLS_H, rng);
      let p = tileCenter(maze.start);
      let dx = 0;
      let dy = 0;
      for (let f = 0; f < 3000; f++) {
        if (rng() < 0.08) {
          dx = Math.floor(rng() * 3) - 1;
          dy = Math.floor(rng() * 3) - 1;
        }
        const dt = rng() < 0.1 ? 0.05 : 1 / 60;
        p = moveHuman(maze, p, dx, dy, BANDIT_SPEED * dt);
        if (inWall(maze, p) || blocked(maze, p.x, p.y, BANDIT_HALF - 0.01)) problems++;
      }
    }
    expect(problems).toBe(0);
  });

  it('CPU: desviando de livros que caem em volta o tempo todo', () => {
    const rng = seeded(5);
    const found: string[] = [];
    for (let m = 0; m < 300; m++) {
      const maze = generateMaze(CELLS_W, CELLS_H, rng);
      const ai = new BanditAI(maze, 'dificil', rng);
      let p = tileCenter(maze.start);
      let books: IncomingBook[] = [];
      let id = 1;
      for (let f = 0; f < 4000; f++) {
        if (rng() < 0.06) books.push({ id: id++, to: { x: p.x + (rng() - 0.5) * 70, y: p.y + (rng() - 0.5) * 70 }, timeLeft: 0.25 + rng() * 0.7 });
        const dt = rng() < 0.1 ? 0.05 : 1 / 60;
        books.forEach((b) => (b.timeLeft -= dt));
        books = books.filter((b) => b.timeLeft > 0);
        const target = ai.update(dt, p, books);
        const before = p;
        if (target) p = stepToward(p, target, ai.speed * dt);
        if (inWall(maze, p) && found.length < 3) found.push(JSON.stringify({ m, f, before, p, target, tile: toTile(p) }));
        const t = toTile(p);
        if (t.x === maze.exit.x && t.y === maze.exit.y) break;
      }
    }
    expect(found).toEqual([]);
  });
});

describe('fuga', () => {
  it('so conta no quadrado da saida, nao em qualquer ponto da linha de cima', () => {
    const maze = generateMaze(CELLS_W, CELLS_H, seeded(9));
    const exit = tileCenter(maze.exit);
    expect(reachedExit(maze, exit)).toBe(true);
    // mesma altura, dois quadrados ao lado (o caso do print): parede, nao fuga
    expect(reachedExit(maze, { x: exit.x + 64, y: exit.y })).toBe(false);
    // entrando na saida por baixo, ainda longe da borda: ainda nao fugiu
    expect(reachedExit(maze, { x: exit.x, y: exit.y + 10 })).toBe(false);
  });
});
