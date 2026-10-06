import { AI, BANDIT_SPEED, Difficulty, HIT_RADIUS, THROW_COOLDOWN, TILE, flightTime } from './config';
import { Maze, Tile, distanceMap, findPath, isOpen } from './maze';
import { Vec, dist, tileCenter, toTile } from './geometry';
import { PlayerModel, Side } from './playerModel';

export type { Vec } from './geometry';
export { tileCenter, toTile } from './geometry';

export interface IncomingBook {
  id: number;
  to: Vec;
  timeLeft: number;
}

/** Bandido controlado pela CPU: segue para a saida e desvia dos livros que enxerga. */
export class BanditAI {
  private path: Tile[] = [];
  private dodging = false;
  private repath = 0;
  private decided = new Set<number>();
  private exitDist: number[][];
  readonly cfg: (typeof AI.bandit)[Difficulty];

  constructor(private maze: Maze, difficulty: Difficulty, private rng: () => number = Math.random) {
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
      if (this.rng() > this.cfg.reactChance) continue;
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

type Widen<T> = { -readonly [K in keyof T]: T[K] extends boolean ? boolean : T[K] extends number ? number : T[K] };
export type LawyerConfig = Widen<(typeof AI.lawyer)[Difficulty]>;

/**
 * Mahayana controlada pela CPU. Em vez de esticar uma reta na direcao do
 * movimento, ela simula dezenas de futuros possiveis do fugitivo pelos
 * corredores, usando o que o PlayerModel aprendeu (bifurcacoes, reacao ao
 * livro, paradas), e mira onde esses futuros mais se concentram.
 */
export class LawyerAI {
  private timer = 1.2;
  private waited = 0;
  private followUp: { target: Vec; in: number } | null = null;
  private cfg: LawyerConfig;

  constructor(
    difficulty: Difficulty,
    private model: PlayerModel,
    private rng: () => number = Math.random,
    overrides: Partial<LawyerConfig> = {},
  ) {
    this.cfg = { ...AI.lawyer[difficulty], ...overrides };
  }

  update(dt: number, hand: Vec, banditPos: Vec, canThrow: boolean): Vec | null {
    // segundo livro do "cerco": cobre a outra rota de fuga
    if (this.followUp) {
      this.followUp.in -= dt;
      if (this.followUp.in <= 0) {
        const target = this.followUp.target;
        this.followUp = null;
        if (canThrow) return this.miss(target);
      }
    }

    this.timer -= dt;
    if (this.timer > 0 || !canThrow) return null;

    const opts = { learned: this.cfg.learned, reactions: this.cfg.reactions };
    let flight = flightTime(dist(hand, banditPos));
    let aim = this.bestSpot(banditPos, flight, opts);
    flight = flightTime(dist(hand, aim.target));
    aim = this.bestSpot(banditPos, flight, opts);

    // paciencia: com o futuro muito incerto (ex.: chegando numa bifurcacao), espera um pouco
    if (aim.confidence < this.cfg.minConfidence && this.waited < this.cfg.patience) {
      this.waited += 0.15;
      this.timer = 0.15;
      return null;
    }
    this.waited = 0;
    this.timer = this.cfg.interval * (0.75 + this.rng() * 0.5);
    if (this.cfg.bracket && aim.second && aim.secondConfidence >= 0.2) {
      this.followUp = { target: aim.second, in: THROW_COOLDOWN + 0.02 };
    }
    return this.miss(aim.target);
  }

  /**
   * Sorteia futuros e acha o ponto que cobre mais deles. Como o jogador reage
   * diferente a um livro na frente ou atras dele, testa os dois lados e so
   * aceita a mira que cai no lado que ela mesma supos (senao a previsao se desfaz).
   */
  private bestSpot(pos: Vec, t: number, opts: { learned: boolean; reactions: boolean }) {
    const sides: Side[] = opts.reactions ? ['frente', 'tras'] : ['frente'];
    const tries = sides.map((side) => {
      const spot = this.cluster(Array.from({ length: this.cfg.samples }, () => this.model.sample(pos, t, this.rng, opts, side)));
      return { ...spot, coherent: !opts.reactions || this.model.sideOf(pos, spot.target) === side };
    });
    const coherent = tries.filter((s) => s.coherent);
    const pool = coherent.length ? coherent : tries;
    return pool.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  }

  private cluster(samples: Vec[]) {
    const r = HIT_RADIUS * 0.85;
    const score = samples.map((a) => samples.reduce((n, b) => n + (dist(a, b) <= r ? 1 : 0), 0));
    let best = 0;
    score.forEach((s, i) => {
      if (s > score[best]) best = i;
    });
    let second = -1;
    score.forEach((s, i) => {
      if (dist(samples[i], samples[best]) > HIT_RADIUS * 2.2 && (second < 0 || s > score[second])) second = i;
    });
    // centro do grupo, e nao a amostra solta
    const group = samples.filter((s) => dist(s, samples[best]) <= r);
    const target = { x: group.reduce((a, s) => a + s.x, 0) / group.length, y: group.reduce((a, s) => a + s.y, 0) / group.length };
    return {
      target,
      confidence: score[best] / samples.length,
      second: second >= 0 ? samples[second] : null,
      secondConfidence: second >= 0 ? score[second] / samples.length : 0,
    };
  }

  private miss(target: Vec): Vec {
    const angle = this.rng() * Math.PI * 2;
    const err = Math.abs(gaussian(this.rng)) * this.cfg.error;
    return { x: target.x + Math.cos(angle) * err, y: target.y + Math.sin(angle) * err };
  }
}

function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
