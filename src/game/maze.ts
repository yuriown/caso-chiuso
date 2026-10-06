export interface Tile {
  x: number;
  y: number;
}

/** true = parede */
export type Grid = boolean[][];

export interface Maze {
  grid: Grid;
  w: number;
  h: number;
  start: Tile;
  exit: Tile;
}

/**
 * Labirinto por backtracking iterativo, com "braid": algumas paredes internas
 * sao removidas para criar rotas alternativas (o bandido precisa de escolhas).
 */
export function generateMaze(cellsW: number, cellsH: number, rng: () => number = Math.random, braid = 0.12): Maze {
  const w = cellsW * 2 + 1;
  const h = cellsH * 2 + 1;
  const grid: Grid = Array.from({ length: h }, () => Array<boolean>(w).fill(true));
  const visited = Array.from({ length: cellsH }, () => Array<boolean>(cellsW).fill(false));

  const startCell = { x: 0, y: cellsH - 1 };
  const stack = [startCell];
  visited[startCell.y][startCell.x] = true;
  grid[startCell.y * 2 + 1][startCell.x * 2 + 1] = false;

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = dirs
      .map((d) => ({ x: cur.x + d.x, y: cur.y + d.y, d }))
      .filter((n) => n.x >= 0 && n.y >= 0 && n.x < cellsW && n.y < cellsH && !visited[n.y][n.x]);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const next = options[Math.floor(rng() * options.length)];
    visited[next.y][next.x] = true;
    grid[cur.y * 2 + 1 + next.d.y][cur.x * 2 + 1 + next.d.x] = false;
    grid[next.y * 2 + 1][next.x * 2 + 1] = false;
    stack.push({ x: next.x, y: next.y });
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!grid[y][x]) continue;
      const horizontal = y % 2 === 1 && x % 2 === 0;
      const vertical = y % 2 === 0 && x % 2 === 1;
      if ((horizontal || vertical) && rng() < braid) grid[y][x] = false;
    }
  }

  const minExitCell = Math.ceil(cellsW / 2);
  const exitCell = minExitCell + Math.floor(rng() * (cellsW - minExitCell));
  const exit = { x: exitCell * 2 + 1, y: 0 };
  grid[exit.y][exit.x] = false;

  return { grid, w, h, start: { x: startCell.x * 2 + 1, y: startCell.y * 2 + 1 }, exit };
}

export function isOpen(maze: Maze, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < maze.w && y < maze.h && !maze.grid[y][x];
}

const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Distancia (em passos) de todo tile aberto ate `from`. -1 = inalcancavel. */
export function distanceMap(maze: Maze, from: Tile, maxDepth = Infinity): number[][] {
  const dist = Array.from({ length: maze.h }, () => Array<number>(maze.w).fill(-1));
  dist[from.y][from.x] = 0;
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const d = dist[cur.y][cur.x];
    if (d >= maxDepth) continue;
    for (const n of NEIGHBORS) {
      const nx = cur.x + n.x;
      const ny = cur.y + n.y;
      if (isOpen(maze, nx, ny) && dist[ny][nx] < 0) {
        dist[ny][nx] = d + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return dist;
}

/** Caminho de `from` ate `to` (sem incluir `from`). null se nao houver. */
export function findPath(maze: Maze, from: Tile, to: Tile): Tile[] | null {
  const dist = distanceMap(maze, to);
  if (dist[from.y][from.x] < 0) return null;
  const path: Tile[] = [];
  let cur = from;
  while (cur.x !== to.x || cur.y !== to.y) {
    const d = dist[cur.y][cur.x];
    const next = NEIGHBORS.map((n) => ({ x: cur.x + n.x, y: cur.y + n.y })).find(
      (n) => isOpen(maze, n.x, n.y) && dist[n.y][n.x] === d - 1,
    );
    if (!next) return null;
    path.push(next);
    cur = next;
  }
  return path;
}
