import { AI, BANDIT_SPEED, Difficulty, HIT_RADIUS, MAZE_X, MAZE_Y, TILE, flightTime } from './config';
import { Maze, Tile, distanceMap, findPath, isOpen } from './maze';

export interface Vec {
  x: number;
  y: number;
}

export interface IncomingBook {
  id: number;
  to: Vec;
  timeLeft: number;
}

export const tileCenter = (t: Tile): Vec => ({ x: MAZE_X + t.x * TILE + TILE / 2, y: MAZE_Y + t.y * TILE + TILE / 2 });
export const toTile = (p: Vec): Tile => ({ x: Math.floor((p.x - MAZE_X) / TILE), y: Math.floor((p.y - MAZE_Y) / TILE) });
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Bandido controlado pela CPU: segue para a saida e desvia dos livros que enxerga. */
export class BanditAI {
  private path: Tile[] = [];
  private dodging = false;
  private repath = 0;
  private decided = new Set<number>();
  private exitDist: number[][];
  readonly cfg: (typeof AI.bandit)[Difficulty];

  constructor(private maze: Maze, difficulty: Difficulty) {
    this.cfg = AI.bandit[difficulty];
    this.exitDist = distanceMap(maze, maze.exit);
  }

  get speed(): number {
    return BANDIT_SPEED * this.cfg.speed;
  }

  /** Devolve o ponto para onde o bandido deve andar agora. */
  update(dt: number, pos: Vec, books: IncomingBook[]): Vec | null {
    const here = toTile(pos);

    for (const b of books) {
      if (this.decided.has(b.id) || b.timeLeft > this.cfg.reactWindow) continue;
      this.decided.add(b.id);
      if (Math.random() > this.cfg.reactChance) continue;
      if (dist(pos, b.to) > HIT_RADIUS + 16) continue;
      const escape = this.findEscape(here, b);
      if (escape) {
        this.path = escape;
        this.dodging = true;
      }
    }

    this.repath -= dt;
    if (!this.dodging && (this.repath <= 0 || this.path.length === 0)) {
      this.path = findPath(this.maze, here, this.maze.exit) ?? [];
      this.repath = 1;
    }

    while (this.path.length) {
      const target = tileCenter(this.path[0]);
      if (dist(pos, target) > 1.5) return target;
      this.path.shift();
    }
    if (this.dodging) {
      this.dodging = false;
      this.repath = 0;
    }
    return null;
  }

  private findEscape(here: Tile, book: IncomingBook): Tile[] | null {
    const reachSteps = Math.max(1, Math.floor(((book.timeLeft + 0.1) * this.speed) / TILE));
    const depth = Math.min(3, reachSteps);
    const local = distanceMap(this.maze, here, depth);
    let best: Tile | null = null;
    let bestScore = -Infinity;
    for (let y = 0; y < this.maze.h; y++) {
      for (let x = 0; x < this.maze.w; x++) {
        if (local[y][x] < 0 || !isOpen(this.maze, x, y)) continue;
        const away = dist(tileCenter({ x, y }), book.to);
        if (away < HIT_RADIUS + 10) continue;
        // prefere ficar longe do livro, desempatando pelo progresso ate a saida
        const score = Math.min(away, 80) - this.exitDist[y][x] * 2;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best ? findPath(this.maze, here, best) : null;
  }
}

/** Mahayana controlada pela CPU: mira prevendo onde o bandido vai estar. */
export class LawyerAI {
  private timer = 1.2;
  private cfg: (typeof AI.lawyer)[Difficulty];

  constructor(difficulty: Difficulty) {
    this.cfg = AI.lawyer[difficulty];
  }

  update(dt: number, hand: Vec, banditPos: Vec, banditVel: Vec, canThrow: boolean): Vec | null {
    this.timer -= dt;
    if (this.timer > 0 || !canThrow) return null;
    this.timer = this.cfg.interval * (0.75 + Math.random() * 0.5);

    let target = { ...banditPos };
    for (let i = 0; i < 3; i++) {
      const t = flightTime(dist(hand, target)) * this.cfg.lead;
      target = { x: banditPos.x + banditVel.x * t, y: banditPos.y + banditVel.y * t };
    }
    const angle = Math.random() * Math.PI * 2;
    const err = Math.abs(gaussian()) * this.cfg.error;
    return { x: target.x + Math.cos(angle) * err, y: target.y + Math.sin(angle) * err };
  }
}

function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
