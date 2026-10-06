import { BANDIT_HALF, MAZE_X, MAZE_Y, TILE } from './config';
import { Maze, isOpen } from './maze';
import { Vec, sameTile, tileCenter, toTile } from './geometry';

/** A caixa de colisao do fugitivo, centrada em (x, y), encosta em alguma parede? */
export function blocked(maze: Maze, x: number, y: number, half = BANDIT_HALF): boolean {
  for (const [cx, cy] of [[x - half, y - half], [x + half, y - half], [x - half, y + half], [x + half, y + half]]) {
    const tx = Math.floor((cx - MAZE_X) / TILE);
    const ty = Math.floor((cy - MAZE_Y) / TILE);
    if (!isOpen(maze, tx, ty)) return true;
  }
  return false;
}

/**
 * Movimento do jogador com colisao e "quina assistida": se a frente esta
 * bloqueada mas o corredor ao lado esta livre, alinha ao centro da faixa.
 */
export function moveHuman(maze: Maze, pos: Vec, dx: number, dy: number, dist: number): Vec {
  const p = { ...pos };
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  const tryAxis = (ax: number, ay: number) => {
    const nx = p.x + ax * dist;
    const ny = p.y + ay * dist;
    if (!blocked(maze, nx, ny)) {
      p.x = nx;
      p.y = ny;
      return;
    }
    const tile = toTile(p);
    const center = tileCenter(tile);
    if (ax !== 0 && isOpen(maze, tile.x + Math.sign(ax), tile.y)) {
      const diff = center.y - p.y;
      p.y += Math.sign(diff) * Math.min(Math.abs(diff), dist);
    } else if (ay !== 0 && isOpen(maze, tile.x, tile.y + Math.sign(ay))) {
      const diff = center.x - p.x;
      p.x += Math.sign(diff) * Math.min(Math.abs(diff), dist);
    }
  };
  if (dx !== 0) tryAxis(dx, 0);
  if (dy !== 0) tryAxis(0, dy);
  return p;
}

/** Anda em linha reta ate `target`, no maximo `maxStep` pixels. */
export function stepToward(pos: Vec, target: Vec, maxStep: number): Vec {
  const d = Math.hypot(target.x - pos.x, target.y - pos.y);
  if (d === 0) return { ...pos };
  const step = Math.min(d, maxStep);
  return { x: pos.x + ((target.x - pos.x) / d) * step, y: pos.y + ((target.y - pos.y) / d) * step };
}

/** Fugiu: chegou ao quadrado da saida (e nao so a altura dela). */
export function reachedExit(maze: Maze, pos: Vec): boolean {
  return sameTile(toTile(pos), maze.exit) && pos.y < tileCenter(maze.exit).y + TILE * 0.1;
}
