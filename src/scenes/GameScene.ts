import Phaser from 'phaser';
import {
  AMMO_REGEN,
  BALCONY_Y,
  BANDIT_HALF,
  BANDIT_LIVES,
  BANDIT_SPEED,
  GameSettings,
  HEIGHT,
  HIT_RADIUS,
  INVULN_TIME,
  MAX_AMMO,
  MAZE_BOTTOM,
  MAZE_X,
  MAZE_Y,
  ROUND_SECONDS,
  STUN_TIME,
  THROW_COOLDOWN,
  TILE,
  WIDTH,
  CELLS_H,
  CELLS_W,
  GRID_W,
  flightTime,
} from '../game/config';
import { Maze, generateMaze, isOpen } from '../game/maze';
import { BanditAI, LawyerAI, Vec, tileCenter } from '../game/ai';
import { audio } from '../game/audio';
import { button, text } from '../game/ui';
import { VirtualJoystick, isTouchDevice } from '../game/joystick';
import { Fugitive, capitalize, fugitive } from '../game/fugitive';
import type { EndData } from './EndScene';

interface Book {
  id: number;
  from: Vec;
  to: Vec;
  t: number;
  duration: number;
  arc: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Image;
}

type State = 'countdown' | 'playing' | 'paused' | 'over';

export class GameScene extends Phaser.Scene {
  private settings!: GameSettings;
  private maze!: Maze;
  private state: State = 'countdown';

  private bandit!: Phaser.GameObjects.Image;
  private banditShadow!: Phaser.GameObjects.Image;
  private who!: Fugitive;
  private banditVel: Vec = { x: 0, y: 0 };
  private lives = BANDIT_LIVES;
  private stun = 0;
  private invuln = 0;
  private walkAnim = 0;

  private lawyer!: Phaser.GameObjects.Image;
  private crosshair!: Phaser.GameObjects.Image;
  private ammo = MAX_AMMO;
  private ammoTimer = 0;
  private cooldown = 0;
  private throwPose = 0;

  private books: Book[] = [];
  private nextBookId = 1;
  private timeLeft = ROUND_SECONDS;

  private banditAI: BanditAI | null = null;
  private lawyerAI: LawyerAI | null = null;

  private hearts: Phaser.GameObjects.Image[] = [];
  private ammoIcons: Phaser.GameObjects.Image[] = [];
  private timerText!: Phaser.GameObjects.Text;
  private pauseItems: Phaser.GameObjects.GameObject[] = [];
  private joystick: VirtualJoystick | null = null;
  private touch = false;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('Game');
  }

  init(settings: GameSettings): void {
    this.settings = settings;
    this.state = 'countdown';
    this.lives = BANDIT_LIVES;
    this.stun = 0;
    this.invuln = 0;
    this.ammo = MAX_AMMO;
    this.ammoTimer = 0;
    this.cooldown = 0;
    this.books = [];
    this.timeLeft = ROUND_SECONDS;
    this.hearts = [];
    this.ammoIcons = [];
    this.pauseItems = [];
    this.joystick = null;
    this.banditVel = { x: 0, y: 0 };
  }

  private get humanLawyer() {
    return this.settings.mode !== 'bandido-vs-cpu';
  }

  private get humanBandit() {
    return this.settings.mode !== 'advogada-vs-cpu';
  }

  create(): void {
    this.maze = generateMaze(CELLS_W, CELLS_H);
    this.drawMaze();
    this.drawBalcony();

    const start = tileCenter(this.maze.start);
    this.banditShadow = this.add.image(start.x, start.y + 12, 'shadow').setDepth(5);
    this.who = fugitive(this.registry);
    this.bandit = this.add.image(start.x, start.y, this.who.frames[0]).setOrigin(0.5, 0.6).setScale(this.who.gameScale).setDepth(10);

    this.lawyer = this.add.image(WIDTH / 2, HEIGHT - 26, 'mahayana-idle').setOrigin(0.5, 1).setDepth(20);
    this.drawRailing();

    this.crosshair = this.add.image(WIDTH / 2, HEIGHT / 2, 'crosshair').setDepth(100).setVisible(this.humanLawyer);
    this.input.setDefaultCursor(this.humanLawyer ? 'none' : 'default');

    if (!this.humanBandit) this.banditAI = new BanditAI(this.maze, this.settings.difficulty);
    if (!this.humanLawyer) this.lawyerAI = new LawyerAI(this.settings.difficulty);

    this.touch = isTouchDevice();
    this.createHud();
    // o analogico escuta o toque antes do arremesso, para o dedo dele nao virar livro
    if (this.humanBandit && this.touch) this.createJoystick();
    this.createInput();
    this.countdown();
  }

  // ---------- cenario ----------

  private drawMaze(): void {
    for (let y = 0; y < this.maze.h; y++) {
      for (let x = 0; x < this.maze.w; x++) {
        const px = MAZE_X + x * TILE;
        const py = MAZE_Y + y * TILE;
        const isExit = x === this.maze.exit.x && y === this.maze.exit.y;
        const key = isExit ? 'exit' : this.maze.grid[y][x] ? 'wall' : (x + y) % 2 ? 'floor-a' : 'floor-b';
        this.add.image(px, py, key).setOrigin(0).setDepth(isExit ? 1 : 0);
      }
    }
    const exit = tileCenter(this.maze.exit);
    const label = text(this, exit.x, MAZE_Y - 8, 'SAÍDA', 14, '#9dffc0').setDepth(52);
    this.tweens.add({ targets: label, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
  }

  private drawBalcony(): void {
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(0x4a2a1a);
    g.fillRect(0, BALCONY_Y, WIDTH, HEIGHT - BALCONY_Y);
    g.fillStyle(0x5c3622);
    for (let y = BALCONY_Y; y < HEIGHT; y += 14) g.fillRect(0, y, WIDTH, 12);
    g.fillStyle(0x2a170e);
    g.fillRect(0, BALCONY_Y, WIDTH, 4);
  }

  private drawRailing(): void {
    const g = this.add.graphics().setDepth(25);
    const top = HEIGHT - 52;
    g.fillStyle(0x7a4a2a);
    g.fillRect(0, top, WIDTH, 8);
    g.fillStyle(0x9a6438);
    g.fillRect(0, top, WIDTH, 2);
    g.fillStyle(0x6a3d22);
    for (let x = 8; x < WIDTH; x += 24) g.fillRect(x, top + 8, 8, HEIGHT - top - 8);
    g.fillStyle(0x3a2012);
    g.fillRect(0, HEIGHT - 6, WIDTH, 6);
  }

  private createHud(): void {
    this.add.rectangle(WIDTH / 2, 20, WIDTH, 40, 0x0d0b1a, 0.9).setDepth(50);
    text(this, 72, 20, this.who.label.toUpperCase(), 18, '#ff8a9a').setDepth(51);
    for (let i = 0; i < BANDIT_LIVES; i++) {
      this.hearts.push(this.add.image(140 + i * 30, 20, 'heart').setDepth(51));
    }
    this.timerText = text(this, WIDTH / 2, 20, '', 28).setDepth(51);
    text(this, WIDTH - 100, 20, 'MAHAYANA', 18, '#f6d55c').setDepth(51);
    for (let i = 0; i < MAX_AMMO; i++) {
      this.ammoIcons.push(this.add.image(WIDTH - 182 - i * 34, 20, 'book-icon').setDepth(51));
    }
    const score = this.registry.get('score') as { advogada: number; bandido: number };
    text(this, WIDTH / 2 - 150, 20, `placar ${score.advogada} x ${score.bandido}`, 16, '#aaaaaa').setDepth(51);

    const labels: Record<GameSettings['mode'], [string, string]> = {
      'advogada-vs-cpu': ['VOCÊ', 'CPU'],
      'bandido-vs-cpu': ['CPU', 'VOCÊ'],
      versus: this.touch ? ['P1 · toque', 'P2 · analógico'] : ['P1 · mouse', 'P2 · WASD/setas'],
    };
    const [l, b] = labels[this.settings.mode];
    if (this.humanBandit && this.touch) {
      // o canto esquerdo da sacada e do analogico
      text(this, WIDTH - 100, HEIGHT - 36, `Mahayana: ${l}`, 14, '#f6d55c').setDepth(30);
    } else {
      text(this, 80, HEIGHT - 16, `Mahayana: ${l}`, 14, '#f6d55c').setDepth(30);
    }
    text(this, WIDTH - 100, HEIGHT - 16, `${this.who.label}: ${b}`, 14, '#ff8a9a').setDepth(30);

    const pauseBtn = this.add.rectangle(WIDTH - 24, 20, 36, 30, 0x2a2547).setStrokeStyle(2, 0x6a60a3).setDepth(52);
    text(this, WIDTH - 24, 20, 'II', 18).setDepth(53);
    pauseBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.togglePause());

    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6).setDepth(200);
    const title = text(this, WIDTH / 2, HEIGHT / 2 - 90, 'PAUSA', 56).setDepth(201);
    const resume = button(this, WIDTH / 2, HEIGHT / 2, 'Continuar', () => this.togglePause(), 260).container.setDepth(201);
    const menu = button(this, WIDTH / 2, HEIGHT / 2 + 64, 'Menu', () => this.scene.start('Menu'), 260).container.setDepth(201);
    const hint = text(this, WIDTH / 2, HEIGHT / 2 + 130, this.touch ? '' : 'P ou Esc: continuar  ·  Q: menu', 18, '#cccccc').setDepth(201);
    this.pauseItems = [shade, title, resume, menu, hint];
    this.pauseItems.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    this.updateHud();
  }

  private updateHud(): void {
    this.hearts.forEach((h, i) => h.setAlpha(i < this.lives ? 1 : 0.15));
    this.ammoIcons.forEach((b, i) => b.setAlpha(i < Math.floor(this.ammo) ? 1 : 0.2));
    const secs = Math.max(0, Math.ceil(this.timeLeft));
    this.timerText.setText(`${secs}s`).setColor(secs <= 10 ? '#ff5470' : '#ffffff');
  }

  // ---------- entrada ----------

  private createInput(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D',
    }) as typeof this.keys;
    kb.on('keydown-M', () => audio.toggleMute());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-Q', () => {
      if (this.state === 'paused') this.scene.start('Menu');
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.joystick?.owns(p)) this.crosshair.setPosition(p.x, p.y);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      audio.unlock();
      if (over.length || this.joystick?.owns(p)) return; // botao ou analogico
      this.crosshair.setPosition(p.x, p.y);
      if (this.state === 'playing' && this.humanLawyer) this.throwBook({ x: p.x, y: p.y });
    });
  }

  private createJoystick(): void {
    const versus = this.settings.mode === 'versus';
    this.joystick = new VirtualJoystick(this, {
      restX: 110,
      restY: HEIGHT - 62,
      // no 2P o labirinto e da Mahayana: o analogico nasce so na metade esquerda da sacada
      zone: versus ? (p) => p.y >= MAZE_BOTTOM && p.x < WIDTH / 2 : () => true,
      bounds: versus
        ? new Phaser.Geom.Rectangle(0, MAZE_BOTTOM - 40, WIDTH / 2, HEIGHT - MAZE_BOTTOM + 40)
        : new Phaser.Geom.Rectangle(0, 40, WIDTH, HEIGHT - 40),
    });
  }

  private togglePause(): void {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
    else return;
    const paused = this.state === 'paused';
    this.pauseItems.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(paused));
    this.joystick?.release();
    if (this.joystick) this.joystick.enabled = !paused;
    this.input.setDefaultCursor(paused || !this.humanLawyer ? 'default' : 'none');
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
  }

  private countdown(): void {
    const label = text(this, WIDTH / 2, MAZE_Y + 250, '', 96, '#f6d55c').setDepth(150).setStroke('#3b2a00', 10);
    const steps = ['3', '2', '1', 'JÁ!'];
    steps.forEach((s, i) => {
      this.time.delayedCall(i * 650, () => {
        label.setText(s).setScale(1.6).setAlpha(1);
        this.tweens.add({ targets: label, scale: 1, duration: 300, ease: 'Back.out' });
        audio.beep(i === steps.length - 1);
        if (i === steps.length - 1) {
          this.state = 'playing';
          this.tweens.add({ targets: label, alpha: 0, delay: 350, duration: 300, onComplete: () => label.destroy() });
        }
      });
    });
  }

  // ---------- regras ----------

  private handPos(): Vec {
    return { x: this.lawyer.x + 10, y: this.lawyer.y - 60 };
  }

  private throwBook(target: Vec): void {
    if (this.ammo < 1 || this.cooldown > 0) return;
    this.ammo -= 1;
    this.cooldown = THROW_COOLDOWN;
    this.throwPose = 0.25;
    this.lawyer.setTexture('mahayana-throw');

    const to = {
      x: Phaser.Math.Clamp(target.x, MAZE_X, MAZE_X + GRID_W * TILE),
      y: Phaser.Math.Clamp(target.y, MAZE_Y, MAZE_BOTTOM),
    };
    const from = this.handPos();
    const d = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const book: Book = {
      id: this.nextBookId++,
      from,
      to,
      t: 0,
      duration: flightTime(d),
      arc: 70 + d * 0.3,
      marker: this.add.image(to.x, to.y, 'marker').setDepth(4).setScale(0.6).setAlpha(0.5),
      shadow: this.add.image(from.x, from.y, 'shadow').setDepth(6).setScale(0.4),
      sprite: this.add.image(from.x, from.y, 'book').setDepth(40),
    };
    this.books.push(book);
    audio.throw();
    this.updateHud();
  }

  private landBook(book: Book): void {
    book.marker.destroy();
    book.shadow.destroy();
    book.sprite.setPosition(book.to.x, book.to.y).setDepth(3).setRotation(Phaser.Math.FloatBetween(-0.6, 0.6));
    this.tweens.add({ targets: book.sprite, alpha: 0, delay: 900, duration: 400, onComplete: () => book.sprite.destroy() });

    const d = Phaser.Math.Distance.Between(this.bandit.x, this.bandit.y, book.to.x, book.to.y);
    if (d <= HIT_RADIUS && this.invuln <= 0 && this.state === 'playing') {
      this.lives -= 1;
      this.stun = STUN_TIME;
      this.invuln = INVULN_TIME;
      this.bandit.setTint(0xff7777);
      this.cameras.main.shake(180, 0.008);
      this.pages(book.to, 10);
      audio.hit();
      const ouch = text(this, this.bandit.x, this.bandit.y - 30, 'OBJEÇÃO!', 18, '#ffdd55').setDepth(60);
      this.tweens.add({ targets: ouch, y: ouch.y - 30, alpha: 0, duration: 800, onComplete: () => ouch.destroy() });
      this.updateHud();
      if (this.lives <= 0) this.finish('advogada', `Três livradas: ${this.who.name} foi condenado!`);
    } else {
      this.pages(book.to, 4);
      audio.miss();
    }
  }

  private pages(at: Vec, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(at.x, at.y, 'page').setDepth(45).setScale(2);
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 30;
      this.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * r,
        y: at.y + Math.sin(a) * r - 10,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: 600 + Math.random() * 300,
        onComplete: () => p.destroy(),
      });
    }
  }

  private finish(winner: EndData['winner'], reason: string): void {
    if (this.state === 'over') return;
    this.state = 'over';
    this.bandit.setAlpha(1);
    const score = this.registry.get('score') as { advogada: number; bandido: number };
    score[winner] += 1;
    this.registry.set('score', score);
    const humanWon =
      this.settings.mode === 'versus' ||
      (winner === 'advogada' && this.humanLawyer) ||
      (winner === 'bandido' && this.humanBandit);
    audio.fanfare(humanWon);
    this.time.delayedCall(900, () => {
      const data: EndData = { settings: this.settings, winner, reason };
      this.scene.launch('End', data);
    });
  }

  // ---------- movimento do bandido ----------

  private blocked(x: number, y: number): boolean {
    const h = BANDIT_HALF;
    for (const [cx, cy] of [[x - h, y - h], [x + h, y - h], [x - h, y + h], [x + h, y + h]]) {
      const tx = Math.floor((cx - MAZE_X) / TILE);
      const ty = Math.floor((cy - MAZE_Y) / TILE);
      if (!isOpen(this.maze, tx, ty)) return true;
    }
    return false;
  }

  /** Movimento com colisao e "quina assistida": alinha ao corredor para nao enroscar. */
  private moveHuman(dx: number, dy: number, dist: number): void {
    const b = this.bandit;
    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    const tryAxis = (ax: number, ay: number) => {
      const nx = b.x + ax * dist;
      const ny = b.y + ay * dist;
      if (!this.blocked(nx, ny)) {
        b.setPosition(nx, ny);
        return;
      }
      // alinha ao centro da faixa se a frente estiver livre
      const tile = { x: Math.floor((b.x - MAZE_X) / TILE), y: Math.floor((b.y - MAZE_Y) / TILE) };
      const center = tileCenter(tile);
      if (ax !== 0 && isOpen(this.maze, tile.x + Math.sign(ax), tile.y)) {
        const diff = center.y - b.y;
        b.y += Math.sign(diff) * Math.min(Math.abs(diff), dist);
      } else if (ay !== 0 && isOpen(this.maze, tile.x, tile.y + Math.sign(ay))) {
        const diff = center.x - b.x;
        b.x += Math.sign(diff) * Math.min(Math.abs(diff), dist);
      }
    };
    if (dx !== 0) tryAxis(dx, 0);
    if (dy !== 0) tryAxis(0, dy);
  }

  private updateBandit(dt: number): void {
    const before = { x: this.bandit.x, y: this.bandit.y };
    if (this.stun > 0) {
      this.stun -= dt;
    } else if (this.banditAI) {
      const target = this.banditAI.update(dt, before, this.incoming());
      if (target) {
        const d = Phaser.Math.Distance.Between(before.x, before.y, target.x, target.y);
        const step = Math.min(d, this.banditAI.speed * dt);
        this.bandit.x += ((target.x - before.x) / d) * step;
        this.bandit.y += ((target.y - before.y) / d) * step;
      }
    } else {
      const k = this.keys;
      let dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
      let dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
      if (!dx && !dy && this.joystick) ({ dx, dy } = this.joystick.direction);
      if (dx || dy) this.moveHuman(dx, dy, BANDIT_SPEED * dt);
    }

    const vx = (this.bandit.x - before.x) / dt;
    const vy = (this.bandit.y - before.y) / dt;
    this.banditVel.x += (vx - this.banditVel.x) * Math.min(1, dt * 8);
    this.banditVel.y += (vy - this.banditVel.y) * Math.min(1, dt * 8);

    const moving = Math.hypot(vx, vy) > 5;
    if (moving) {
      this.walkAnim += dt;
      if (vx !== 0 && this.who.flip) this.bandit.setFlipX(vx < 0);
    }
    this.bandit.setTexture(this.who.frames[moving && Math.floor(this.walkAnim * 8) % 2 ? 1 : 0]);
    this.banditShadow.setPosition(this.bandit.x, this.bandit.y + 12);

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.bandit.setAlpha(Math.floor(this.invuln * 12) % 2 ? 0.35 : 1);
      if (this.invuln <= 0) {
        this.bandit.setAlpha(1);
        this.bandit.clearTint();
      }
    }

    if (this.bandit.y < MAZE_Y + TILE * 0.6) this.finish('bandido', `${capitalize(this.who.name)} atravessou o labirinto e fugiu!`);
  }

  private incoming() {
    return this.books.map((b) => ({ id: b.id, to: b.to, timeLeft: (1 - b.t) * b.duration }));
  }

  // ---------- ciclo ----------

  update(_time: number, deltaMs: number): void {
    if (this.state === 'paused') return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (this.state !== 'playing') return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.updateHud();
      this.finish('advogada', 'O tempo acabou e a polícia chegou!');
      return;
    }

    this.cooldown -= dt;
    if (this.ammo < MAX_AMMO) {
      this.ammoTimer += dt;
      if (this.ammoTimer >= AMMO_REGEN) {
        this.ammoTimer = 0;
        this.ammo += 1;
      }
    } else {
      this.ammoTimer = 0;
    }

    // Mahayana anda pela sacada acompanhando a mira (ou o bandido, na CPU)
    const followX = this.humanLawyer ? this.crosshair.x : this.bandit.x;
    const targetX = Phaser.Math.Clamp(followX, 60, WIDTH - 60);
    this.lawyer.x += (targetX - this.lawyer.x) * Math.min(1, dt * 4);
    if (this.throwPose > 0) {
      this.throwPose -= dt;
      if (this.throwPose <= 0) this.lawyer.setTexture('mahayana-idle');
    }

    if (this.lawyerAI) {
      const aim = this.lawyerAI.update(dt, this.handPos(), { x: this.bandit.x, y: this.bandit.y }, this.banditVel, this.ammo >= 1 && this.cooldown <= 0);
      if (aim) this.throwBook(aim);
    }

    this.updateBandit(dt);
    if (this.state !== 'playing') return;

    for (const book of [...this.books]) {
      book.t += dt / book.duration;
      const p = Math.min(book.t, 1);
      const gx = Phaser.Math.Linear(book.from.x, book.to.x, p);
      const gy = Phaser.Math.Linear(book.from.y, book.to.y, p);
      const h = book.arc * 4 * p * (1 - p);
      book.sprite.setPosition(gx, gy - h).setRotation(book.sprite.rotation + dt * 14).setScale(1 + h / 160);
      book.shadow.setPosition(gx, gy).setScale(0.4 + 0.6 * p).setAlpha(0.3 + 0.7 * p);
      book.marker.setAlpha(0.35 + 0.65 * p).setScale(0.6 + 0.4 * p);
      if (book.t >= 1) {
        this.books.splice(this.books.indexOf(book), 1);
        this.landBook(book);
        if (this.state !== 'playing') break;
      }
    }

    this.updateHud();
  }
}
