import { describe, expect, it } from 'vitest';
import { BanditAI, IncomingBook, LawyerAI, Vec, tileCenter, toTile } from './ai';
import { CELLS_H, CELLS_W, Difficulty, HIT_RADIUS, ROUND_SECONDS, flightTime } from './config';
import { generateMaze, isOpen } from './maze';

const DT = 1 / 60;

interface Flying extends IncomingBook {
  duration: number;
}

/** Partida simulada CPU x CPU, com as mesmas regras de acerto do jogo. */
function simulate(difficulty: Difficulty) {
  const maze = generateMaze(CELLS_W, CELLS_H);
  const bandit = new BanditAI(maze, difficulty);
  const lawyer = new LawyerAI(difficulty);
  let pos = tileCenter(maze.start);
  let vel: Vec = { x: 0, y: 0 };
  let books: Flying[] = [];
  let id = 1;
  let lives = 3;
  let invuln = 0;
  let stun = 0;
  let ammo = 5;
  let leftWall = false;
  const hand = { x: 480, y: 660 };

  for (let t = 0; t < ROUND_SECONDS; t += DT) {
    const before = { ...pos };
    if (stun > 0) stun -= DT;
    else {
      const target = bandit.update(DT, pos, books);
      if (target) {
        const d = Math.hypot(target.x - pos.x, target.y - pos.y);
        const step = Math.min(d, bandit.speed * DT);
        pos = { x: pos.x + ((target.x - pos.x) / d) * step, y: pos.y + ((target.y - pos.y) / d) * step };
      }
    }
    const tile = toTile(pos);
    if (!isOpen(maze, tile.x, tile.y)) leftWall = true;
    vel = { x: (pos.x - before.x) / DT, y: (pos.y - before.y) / DT };
    invuln -= DT;
    ammo = Math.min(5, ammo + DT / 1.4);

    const aim = lawyer.update(DT, hand, pos, vel, ammo >= 1);
    if (aim) {
      ammo -= 1;
      const duration = flightTime(Math.hypot(aim.x - hand.x, aim.y - hand.y));
      books.push({ id: id++, to: aim, timeLeft: duration, duration });
    }
    for (const b of books) b.timeLeft -= DT;
    for (const b of books.filter((b) => b.timeLeft <= 0)) {
      if (invuln <= 0 && Math.hypot(pos.x - b.to.x, pos.y - b.to.y) <= HIT_RADIUS) {
        lives--;
        invuln = 1.5;
        stun = 0.5;
        if (lives <= 0) return { winner: 'advogada', leftWall };
      }
    }
    books = books.filter((b) => b.timeLeft > 0);
    if (tile.x === maze.exit.x && tile.y === maze.exit.y) return { winner: 'bandido', leftWall };
  }
  return { winner: 'advogada', leftWall };
}

describe('CPU x CPU', () => {
  for (const difficulty of ['facil', 'normal', 'dificil'] as Difficulty[]) {
    it(`partidas equilibradas e bandido nunca atravessa parede (${difficulty})`, () => {
      const games = Array.from({ length: 200 }, () => simulate(difficulty));
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
