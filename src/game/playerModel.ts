import { BANDIT_SPEED, HIT_RADIUS, TILE } from './config';
import { Maze, Tile, distanceMap, findPath, isOpen } from './maze';
import { Vec, dist, sameTile, tileCenter, toTile } from './geometry';

/** O que o fugitivo faz numa bifurcacao. */
export type Choice = 'saida' | 'longe' | 'volta';

type Weights<K extends string> = Record<K, number>;

const CHOICE_PRIOR: Weights<Choice> = { saida: 2, longe: 1, volta: 0.3 };
/** Onde o marcador do livro aparece em relacao ao fugitivo: a reacao depende disso. */
export type Side = 'frente' | 'tras';

/**
 * Quanto o fugitivo anda pelo corredor enquanto um livro cai perto dele,
 * como fracao do que andaria se seguisse reto: 1 = seguiu, 0 = parou, negativo = deu re.
 * Separado por lado do marcador; comeca com palpites e vai sendo trocado pelo que ele faz.
 */
const PROGRESS_PRIOR: Record<Side, number[]> = { frente: [1, 0.6, 0.2, -0.2], tras: [1, 1, 1, 0.7] };
const PROGRESS_MEMORY = 30;
/** esquecimento: cada observacao nova pesa mais que as antigas (~30 lembradas) */
const FORGET = 0.97;

const NEIGHBORS: Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

interface PendingThrow {
  from: Vec;
  heading: Tile;
  reach: number;
  side: Side;
}

export interface Walk {
  pos: Vec;
  heading: Tile;
}

export interface SampleOptions {
  /** usa o que aprendeu do jogador; false = so palpites genericos */
  learned: boolean;
  /** considera que o jogador reage ao livro que ve chegando */
  reactions: boolean;
}

/**
 * Modelo do jogador que foge: observa como ele anda e reage, e devolve
 * posicoes futuras provaveis. Sobrevive entre revanches; o labirinto de cada
 * rodada entra em `beginRound`.
 */
export class PlayerModel {
  private choices: Weights<Choice> = { ...CHOICE_PRIOR };
  private progress: Record<Side, number[]> = { frente: [...PROGRESS_PRIOR.frente], tras: [...PROGRESS_PRIOR.tras] };
  private stopFraction = 0.1;
  speed = BANDIT_SPEED;

  private maze!: Maze;
  private exitDist!: number[][];
  private lastTile: Tile | null = null;
  private prevTile: Tile | null = null;
  private lastPos: Vec | null = null;
  heading: Tile | null = null;
  private pending = new Map<number, PendingThrow>();

  /** quantas decisoes e reacoes ja viu (para saber se ja "conhece" o jogador) */
  seen = { choices: 0, reactions: 0 };

  beginRound(maze: Maze): void {
    this.maze = maze;
    this.exitDist = distanceMap(maze, maze.exit);
    this.lastTile = null;
    this.prevTile = null;
    this.lastPos = null;
    this.heading = null;
    this.pending.clear();
  }

  // ---------- observacao ----------

  observe(dt: number, pos: Vec, free: boolean): void {
    const tile = toTile(pos);
    if (this.lastTile && !sameTile(tile, this.lastTile) && Math.abs(tile.x - this.lastTile.x) + Math.abs(tile.y - this.lastTile.y) === 1) {
      const from = this.lastTile;
      if (this.prevTile && this.isJunction(from, this.prevTile)) {
        this.record(this.choices, this.categorize(from, tile, this.prevTile));
        this.seen.choices++;
      }
      this.heading = { x: tile.x - from.x, y: tile.y - from.y };
      this.prevTile = from;
    }
    if (!this.lastTile || !sameTile(tile, this.lastTile)) this.lastTile = tile;

    if (free && this.lastPos && dt > 0) {
      const v = dist(pos, this.lastPos) / dt;
      const stopped = v < 10 ? 1 : 0;
      this.stopFraction += (stopped - this.stopFraction) * Math.min(1, dt / 8);
      if (!stopped) this.speed += (v - this.speed) * Math.min(1, dt * 2);
    }
    this.lastPos = { ...pos };
  }

  /** Livro arremessado: guarda de onde o jogador partiu, se o livro ameaca o caminho dele. */
  onThrow(id: number, target: Vec, flight: number, pos: Vec): void {
    const heading = this.headingAt(pos);
    const reach = this.speed * flight;
    const ifContinues = this.walk(pos, heading, reach, (c, at, back) => this.mostLikely(c, at, back)).pos;
    // so conta como reacao se o livro ameacava o caminho dele
    const threatened = dist(target, ifContinues) < HIT_RADIUS + 26 || dist(target, pos) < HIT_RADIUS + 26;
    if (!threatened || reach < 20) return;
    this.pending.set(id, { from: { ...pos }, heading, reach, side: this.sideOf(pos, target) });
  }

  /** Livro caiu: mede quanto o jogador avancou (ou recuou) pelo corredor nesse tempo. */
  onLand(id: number, pos: Vec): void {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    const moved = this.signedProgress(p.from, p.heading, pos);
    const list = this.progress[p.side];
    list.push(Math.max(-1.2, Math.min(1.2, moved / p.reach)));
    if (list.length > PROGRESS_MEMORY) list.shift();
    this.seen.reactions++;
  }

  /** O marcador em `target` aparece na frente ou atras de quem esta em `pos`? */
  sideOf(pos: Vec, target: Vec): Side {
    return this.signedProgress(pos, this.headingAt(pos), target) > 8 ? 'frente' : 'tras';
  }

  /** Distancia pelo labirinto de `from` ate `to`, negativa se `to` ficou para tras. */
  private signedProgress(from: Vec, heading: Tile, to: Vec): number {
    const a = toTile(from);
    const b = toTile(to);
    if (sameTile(a, b)) return (to.x - from.x) * heading.x + (to.y - from.y) * heading.y;
    const fromHere = distanceMap(this.maze, a);
    const behind = { x: a.x - heading.x, y: a.y - heading.y };
    const steps = fromHere[b.y]?.[b.x] ?? -1;
    if (steps < 0) return 0;
    let backwards = false;
    if (isOpen(this.maze, behind.x, behind.y)) {
      const fromBehind = distanceMap(this.maze, behind);
      backwards = fromBehind[b.y][b.x] < steps;
    }
    return (backwards ? -1 : 1) * steps * TILE;
  }

  // ---------- previsao ----------

  /** Uma posicao possivel do jogador daqui a `t` segundos. */
  sample(pos: Vec, t: number, rng: () => number, opts: SampleOptions, side: Side = 'frente'): Vec {
    const stop = opts.learned ? this.stopFraction : 0.1;
    if (rng() < stop * 0.6) return { ...pos };
    const heading = this.headingAt(pos);
    const pick = (c: Tile[], at: Tile, back: Tile) => this.sampleChoice(c, at, back, rng, opts.learned);
    // quanto ele anda com o livro no ar: sorteado do que ja fez (ou "segue reto", se nao aprende)
    const seen = this.progress[side];
    const ratio = opts.reactions ? seen[Math.floor(rng() * seen.length)] + (rng() - 0.5) * 0.15 : 1;
    const reach = this.speed * t * Math.abs(ratio);
    if (ratio >= 0) return this.walk(pos, heading, reach, pick).pos;
    return this.walk(pos, { x: -heading.x, y: -heading.y }, reach, pick).pos;
  }

  /** Probabilidades atuais, para depuracao e testes. */
  get profile() {
    const norm = <K extends string>(w: Weights<K>) => {
      const total = Object.values<number>(w).reduce((a, b) => a + b, 0);
      return Object.fromEntries(Object.entries<number>(w).map(([k, v]) => [k, +(v / total).toFixed(2)]));
    };
    const all = [...this.progress.frente, ...this.progress.tras];
    const share = (f: (r: number) => boolean) => +(all.filter(f).length / all.length).toFixed(2);
    const mean = (l: number[]) => +(l.reduce((a, b) => a + b, 0) / l.length).toFixed(2);
    return {
      choices: norm(this.choices),
      reactions: { segue: share((r) => r > 0.6), para: share((r) => r >= -0.2 && r <= 0.6), volta: share((r) => r < -0.2) },
      avancoMedio: { frente: mean(this.progress.frente), tras: mean(this.progress.tras) },
      parado: +this.stopFraction.toFixed(2),
    };
  }

  // ---------- caminhada pelo labirinto ----------

  private headingAt(pos: Vec): Tile {
    if (this.heading) return this.heading;
    // ainda nao andou: supoe que vai pelo menor caminho ate a saida
    const here = toTile(pos);
    const path = findPath(this.maze, here, this.maze.exit);
    return path?.length ? { x: path[0].x - here.x, y: path[0].y - here.y } : { x: 0, y: -1 };
  }

  /** Anda `distance` pixels pelos corredores a partir de `pos`, escolhendo nas bifurcacoes com `choose`. */
  walk(pos: Vec, heading: Tile, distance: number, choose: (cands: Tile[], at: Tile, back: Tile) => Tile): Walk {
    let cur = toTile(pos);
    let h = heading;
    if (!isOpen(this.maze, cur.x, cur.y)) return { pos: { ...pos }, heading: h };
    const c = tileCenter(cur);
    let rest = distance + ((pos.x - c.x) * h.x + (pos.y - c.y) * h.y);
    if (rest <= 0) return { pos: { x: pos.x + h.x * distance, y: pos.y + h.y * distance }, heading: h };

    for (let guard = 0; guard < 200; guard++) {
      if (sameTile(cur, this.maze.exit)) return { pos: tileCenter(cur), heading: h };
      const back = { x: cur.x - h.x, y: cur.y - h.y };
      const ahead = NEIGHBORS.map((n) => ({ x: cur.x + n.x, y: cur.y + n.y })).filter(
        (n) => isOpen(this.maze, n.x, n.y) && !sameTile(n, back),
      );
      let next: Tile;
      if (ahead.length === 0) next = isOpen(this.maze, back.x, back.y) ? back : cur;
      else if (ahead.length === 1) next = ahead[0];
      else next = choose(ahead, cur, back);
      if (sameTile(next, cur)) return { pos: tileCenter(cur), heading: h };

      const a = tileCenter(cur);
      const b = tileCenter(next);
      h = { x: next.x - cur.x, y: next.y - cur.y };
      if (rest <= TILE) {
        const f = rest / TILE;
        return { pos: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, heading: h };
      }
      rest -= TILE;
      cur = next;
    }
    return { pos: tileCenter(cur), heading: h };
  }

  private isJunction(at: Tile, cameFrom: Tile): boolean {
    let open = 0;
    for (const n of NEIGHBORS) {
      const t = { x: at.x + n.x, y: at.y + n.y };
      if (isOpen(this.maze, t.x, t.y) && !sameTile(t, cameFrom)) open++;
    }
    return open >= 2;
  }

  private categorize(at: Tile, to: Tile, cameFrom: Tile): Choice {
    if (sameTile(to, cameFrom)) return 'volta';
    return this.exitDist[to.y][to.x] < this.exitDist[at.y][at.x] ? 'saida' : 'longe';
  }

  /** peso de cada opcao numa bifurcacao (inclui voltar) */
  private options(cands: Tile[], at: Tile, back: Tile, learned: boolean): [Tile, number][] {
    const w = learned ? this.choices : CHOICE_PRIOR;
    const byCat = new Map<Choice, Tile[]>();
    for (const c of cands) {
      const cat = this.categorize(at, c, back);
      byCat.set(cat, [...(byCat.get(cat) ?? []), c]);
    }
    const out: [Tile, number][] = [];
    for (const [cat, tiles] of byCat) for (const t of tiles) out.push([t, w[cat] / tiles.length]);
    if (isOpen(this.maze, back.x, back.y)) out.push([back, w.volta]);
    return out;
  }

  private mostLikely(cands: Tile[], at: Tile, back: Tile): Tile {
    return this.options(cands, at, back, true).sort((a, b) => b[1] - a[1])[0][0];
  }

  private sampleChoice(cands: Tile[], at: Tile, back: Tile, rng: () => number, learned: boolean): Tile {
    const opts = this.options(cands, at, back, learned);
    const total = opts.reduce((s, o) => s + o[1], 0);
    let r = rng() * total;
    for (const [t, w] of opts) if ((r -= w) <= 0) return t;
    return opts[opts.length - 1][0];
  }

  private record<K extends string>(w: Weights<K>, key: K): void {
    for (const k in w) w[k] *= FORGET;
    w[key] += 1;
  }
}
