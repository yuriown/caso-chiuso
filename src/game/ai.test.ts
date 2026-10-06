import { describe, expect, it } from 'vitest';
import { BanditAI, IncomingBook, LawyerAI, LawyerConfig, Vec, tileCenter, toTile } from './ai';
import { BANDIT_SPEED, CELLS_H, CELLS_W, Difficulty, HIT_RADIUS, ROUND_SECONDS, flightTime } from './config';
import { Maze, Tile, findPath, generateMaze, isOpen } from './maze';
import { PlayerModel } from './playerModel';

const DT = 1 / 60;
const HAND = { x: 480, y: 660 };

/** gerador deterministico: os testes nao podem depender da sorte */
function seeded(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Flying extends IncomingBook {
  duration: number;
}

interface Runner {
  speed: number;
  update(dt: number, pos: Vec, books: Flying[]): Vec | null;
}

/**
 * "Jogador" com uma mania fixa, para medir se a Mahayana aprende:
 * vai pelo menor caminho e, quando ve um livro caindo no caminho, sempre da re.
 */
class HabitBandit implements Runner {
  speed = BANDIT_SPEED;
  private trail: Tile[] = [];
  private backPath: Tile[] = [];
  private backUntil = 0;
  private clock = 0;
  private seen = new Set<number>();

  constructor(private maze: Maze, private reacts = true) {}

  update(dt: number, pos: Vec, books: Flying[]): Vec | null {
    this.clock += dt;
    const here = toTile(pos);

    for (const b of books) {
      if (this.seen.has(b.id) || b.timeLeft > 0.55) continue;
      this.seen.add(b.id);
      const path = findPath(this.maze, here, this.maze.exit) ?? [];
      const ahead = path[Math.min(path.length - 1, 1)];
      const threat = [pos, ahead ? tileCenter(ahead) : pos].some((p) => Math.hypot(p.x - b.to.x, p.y - b.to.y) < HIT_RADIUS + 20);
      if (threat && this.reacts && this.clock >= this.backUntil) {
        // re de ate dois quadrados pelo caminho de onde veio
        this.backPath = this.trail.slice(-3, -1).reverse();
        this.backUntil = this.clock + 0.7;
      }
    }

    if (this.clock < this.backUntil && this.backPath.length) {
      const target = tileCenter(this.backPath[0]);
      if (Math.hypot(target.x - pos.x, target.y - pos.y) < 1.5) this.backPath.shift();
      return target;
    }
    this.backPath = [];
    const last = this.trail[this.trail.length - 1];
    if (!last || last.x !== here.x || last.y !== here.y) this.trail.push(here);
    const path = findPath(this.maze, here, this.maze.exit);
    const c = tileCenter(here);
    if (Math.hypot(c.x - pos.x, c.y - pos.y) > 1.5 && path && path.length) {
      // termina de entrar no tile antes de virar, como o jogo faz
      const next = tileCenter(path[0]);
      const toward = (next.x - c.x) * (pos.x - c.x) + (next.y - c.y) * (pos.y - c.y) > 0;
      return toward ? next : c;
    }
    return path && path.length ? tileCenter(path[0]) : null;
  }
}

interface Result {
  winner: 'advogada' | 'bandido';
  throws: number;
  hits: number;
  leftWall: boolean;
}

/** Uma partida com as mesmas regras de acerto do jogo. */
function play(maze: Maze, runner: Runner, lawyer: LawyerAI, model: PlayerModel): Result {
  model.beginRound(maze);
  let pos = tileCenter(maze.start);
  let books: Flying[] = [];
  let id = 1;
  let lives = 3;
  let invuln = 0;
  let stun = 0;
  let ammo = 5;
  let throws = 0;
  let hits = 0;
  let leftWall = false;

  for (let t = 0; t < ROUND_SECONDS; t += DT) {
    if (stun > 0) stun -= DT;
    else {
      const target = runner.update(DT, pos, books);
      if (target) {
        const d = Math.hypot(target.x - pos.x, target.y - pos.y);
        if (d > 0) {
          const step = Math.min(d, runner.speed * DT);
          pos = { x: pos.x + ((target.x - pos.x) / d) * step, y: pos.y + ((target.y - pos.y) / d) * step };
        }
      }
    }
    const tile = toTile(pos);
    if (!isOpen(maze, tile.x, tile.y)) leftWall = true;
    model.observe(DT, pos, stun <= 0);
    invuln -= DT;
    ammo = Math.min(5, ammo + DT / 1.4);

    const aim = lawyer.update(DT, HAND, pos, ammo >= 1);
    if (aim) {
      ammo -= 1;
      throws++;
      const duration = flightTime(Math.hypot(aim.x - HAND.x, aim.y - HAND.y));
      books.push({ id, to: aim, timeLeft: duration, duration });
      model.onThrow(id, aim, duration, pos);
      id++;
    }
    for (const b of books) b.timeLeft -= DT;
    for (const b of books.filter((b) => b.timeLeft <= 0)) {
      model.onLand(b.id, pos);
      if (invuln <= 0 && Math.hypot(pos.x - b.to.x, pos.y - b.to.y) <= HIT_RADIUS) {
        hits++;
        lives--;
        invuln = 1.5;
        stun = 0.5;
        if (lives <= 0) return { winner: 'advogada', throws, hits, leftWall };
      }
    }
    books = books.filter((b) => b.timeLeft > 0);
    if (tile.x === maze.exit.x && tile.y === maze.exit.y) return { winner: 'bandido', throws, hits, leftWall };
  }
  return { winner: 'advogada', throws, hits, leftWall };
}

describe('CPU x CPU', () => {
  for (const difficulty of ['facil', 'normal', 'dificil'] as Difficulty[]) {
    it(`partidas equilibradas e bandido nunca atravessa parede (${difficulty})`, () => {
      const rng = seeded(7);
      const model = new PlayerModel();
      const lawyer = new LawyerAI(difficulty, model, rng);
      const games = Array.from({ length: 200 }, () => {
        const maze = generateMaze(CELLS_W, CELLS_H, rng);
        return play(maze, new BanditAI(maze, difficulty, rng), lawyer, model);
      });
      const banditWins = games.filter((g) => g.winner === 'bandido').length;
      expect(games.some((g) => g.leftWall)).toBe(false);
      console.log(`${difficulty}: bandido venceu ${banditWins}/200`);
      if (difficulty === 'normal') {
        expect(banditWins).toBeGreaterThan(50);
        expect(banditWins).toBeLessThan(170);
      }
    });
  }
});

describe('Mahayana aprende o padrao do jogador', () => {
  /** taxa de acerto nas ultimas rodadas, depois de algumas para aprender */
  function accuracy(overrides: Partial<LawyerConfig>, reacts = true): number {
    const rng = seeded(42);
    const model = new PlayerModel();
    const lawyer = new LawyerAI('normal', model, rng, overrides);
    let throws = 0;
    let hits = 0;
    for (let round = 0; round < 60; round++) {
      const maze = generateMaze(CELLS_W, CELLS_H, rng);
      const r = play(maze, new HabitBandit(maze, reacts), lawyer, model);
      if (round >= 10) {
        throws += r.throws;
        hits += r.hits;
      }
    }
    return hits / throws;
  }

  it('acerta mais quem da re sempre que ve um livro', () => {
    const naive = accuracy({ learned: false, reactions: false });
    const learned = accuracy({});
    console.log(`acerto contra quem sempre da re: sem aprender ${(naive * 100).toFixed(0)}%, aprendendo ${(learned * 100).toFixed(0)}%`);
    expect(learned).toBeGreaterThan(naive + 0.03);
  });

  it('nao piora contra quem nunca desvia', () => {
    const naive = accuracy({ learned: false, reactions: false }, false);
    const learned = accuracy({}, false);
    console.log(`acerto contra quem nunca desvia: sem aprender ${(naive * 100).toFixed(0)}%, aprendendo ${(learned * 100).toFixed(0)}%`);
    expect(learned).toBeGreaterThan(naive * 0.85);
  });

  it('descobre a mania: para de supor que ele segue reto', () => {
    const rng = seeded(3);
    const model = new PlayerModel();
    const lawyer = new LawyerAI('normal', model, rng);
    for (let round = 0; round < 15; round++) {
      const maze = generateMaze(CELLS_W, CELLS_H, rng);
      play(maze, new HabitBandit(maze), lawyer, model);
    }
    const { reactions } = model.profile;
    console.log('perfil aprendido:', JSON.stringify(model.profile));
    expect(reactions.segue).toBeLessThan(0.3);
  });
});
