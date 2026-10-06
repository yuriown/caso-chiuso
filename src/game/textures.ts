import Phaser from 'phaser';
import { TILE } from './config';

/**
 * Todos os assets do jogo sao desenhados aqui, em codigo: pixel art definida
 * como texto (um caractere = um pixel) e tiles pintados no canvas.
 */

type Palette = Record<string, string>;

const PALETTE: Palette = {
  Y: '#f6d55c', // cabelo loiro
  y: '#d4a62a', // cabelo sombra
  S: '#f7c9a1', // pele
  s: '#e0a27c',
  G: '#1fbf5f', // olhos verdes
  R: '#d1394b', // batom / coracao
  K: '#26305a', // blazer
  k: '#1a2142',
  W: '#ffffff',
  X: '#1b1b1b', // sapatos
  B: '#8a3b1c', // livro
  b: '#f2e6c8', // paginas
  D: '#2b2b2b', // touca
  M: '#0b0b0b', // mascara
  P: '#3b3d63', // calca
  N: '#b0834f', // saco de dinheiro
  Z: '#ffd34d', // cifrao
  r: '#ff8a9a', // brilho do coracao
};

const MAHAYANA_BASE = [
  '.....yYYYYy.....',
  '....yYYYYYYy....',
  '...yYYYYYYYYy...',
  '...YYYYYSSSYY...',
  '...YYSSSSSSYY...',
  '...YYSGSSGSYY...',
  '...YYSSSSSSYY...',
  '...YYSSRRSSYY...',
  '...YYYSSSSYYY...',
  '..YYYYSSSSYYYY..',
  '..YYKKKWWKKKYY..',
  '..YkKKKWWKKKkY..',
  '..YkKKKWWKKKkY..',
  '...kKKKWWKKKk...',
  '...kKKKKKKKKk...',
  '...SKKKKKKKKS...',
  '....KKKKKKKK....',
  '....KKKKKKKK....',
  '....KKKKKKKK....',
  '.....SS..SS.....',
  '.....SS..SS.....',
  '.....SS..SS.....',
  '....XXX..XXX....',
  '................',
];

const BANDIT_A = [
  '....DDDDDD......',
  '...DDDDDDDD.....',
  '...DDDDDDDD.....',
  '...SSSSSSSS.....',
  '...MWWMMWWM.....',
  '...MMMMMMMM.....',
  '...SSSSSSSS.....',
  '....SSSSSS......',
  '..KKKKKKKKKK....',
  '.SWWWWWWWWWWSNN.',
  '.SKKKKKKKKKKNNNN',
  '.SWWWWWWWWWWNZZN',
  '..KKKKKKKKKK.NN.',
  '..PPPPPPPPPP....',
  '..PPPP..PPPP....',
  '..XXXX..XXXX....',
];

const HEART = ['.RR.RR.', 'RrRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];

const BOOK = ['.BBBBBBBBBB.', 'BBBBBBBBBBBB', 'BBZZZZZZZZBB', 'BBBBBBBBBBBB', 'BBBBBBBBBBBB', 'bbbbbbbbbbbb', '.bbbbbbbbbb.'];

function withPixels(rows: string[], pixels: [number, number, string][]): string[] {
  const out = rows.map((r) => r.split(''));
  for (const [x, y, ch] of pixels) out[y][x] = ch;
  return out.map((r) => r.join(''));
}

function mahayanaIdle(): string[] {
  // segurando um livro na mao direita
  return withPixels(MAHAYANA_BASE, [
    [12, 14, 'B'], [13, 14, 'B'], [14, 14, 'B'],
    [12, 15, 'B'], [13, 15, 'b'], [14, 15, 'B'],
    [12, 16, 'B'], [13, 16, 'B'], [14, 16, 'B'],
  ]);
}

function mahayanaThrow(): string[] {
  // braco levantado arremessando
  return withPixels(MAHAYANA_BASE, [
    [12, 11, 'K'], [12, 12, 'K'], [12, 13, 'K'], [12, 14, 'K'], [12, 15, '.'], [13, 11, 'Y'], [13, 12, 'Y'],
    [13, 9, 'k'], [14, 8, 'k'], [14, 7, 'k'], [14, 6, 'S'],
    [13, 3, 'B'], [14, 3, 'B'], [15, 3, 'B'],
    [13, 4, 'B'], [14, 4, 'b'], [15, 4, 'B'],
    [13, 5, 'B'], [14, 5, 'B'], [15, 5, 'B'],
  ]);
}

function banditB(): string[] {
  const rows = [...BANDIT_A];
  rows[14] = '...PPP..PPP.....';
  rows[15] = '..XXX....XXX....';
  return rows;
}

/** Desenha pixel art com contorno escuro de 1px automatico. */
function pixelCanvas(rows: string[], scale: number, outline = '#120e1f'): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = (w + 2) * scale;
  canvas.height = (h + 2) * scale;
  const ctx = canvas.getContext('2d')!;
  const at = (x: number, y: number) => (rows[y]?.[x] ?? '.') !== '.';

  if (outline) {
    ctx.fillStyle = outline;
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
          ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
        }
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.';
      if (ch === '.') continue;
      ctx.fillStyle = PALETTE[ch] ?? '#ff00ff';
      ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
    }
  }
  return canvas;
}

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
}

function wallTile(): HTMLCanvasElement {
  return canvas(TILE, TILE, (ctx) => {
    ctx.fillStyle = '#2a2547';
    ctx.fillRect(0, 0, TILE, TILE);
    const bh = 8;
    for (let row = 0; row < TILE / bh; row++) {
      const offset = row % 2 ? 8 : 0;
      for (let bx = -16; bx < TILE; bx += 16) {
        const x = bx + offset;
        const y = row * bh;
        ctx.fillStyle = row % 2 ? '#4a4277' : '#544b86';
        ctx.fillRect(x + 1, y + 1, 14, bh - 2);
        ctx.fillStyle = '#6a60a3';
        ctx.fillRect(x + 1, y + 1, 14, 1);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, TILE - 3, TILE, 3);
  });
}

function floorTile(alt: boolean): HTMLCanvasElement {
  return canvas(TILE, TILE, (ctx) => {
    ctx.fillStyle = alt ? '#e4dcc5' : '#d6ccb0';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = 'rgba(120,100,70,0.18)';
    ctx.fillRect(0, 0, TILE, 1);
    ctx.fillRect(0, 0, 1, TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(4, 4, 3, 1);
    ctx.fillRect(20, 19, 4, 1);
  });
}

function exitTile(): HTMLCanvasElement {
  return canvas(TILE, TILE, (ctx) => {
    ctx.fillStyle = '#0f3d24';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#1f8a4c';
    ctx.fillRect(3, 3, TILE - 6, TILE - 3);
    ctx.fillStyle = '#9dffc0';
    // seta para cima
    ctx.fillRect(14, 10, 4, 14);
    ctx.fillRect(10, 14, 12, 2);
    ctx.fillRect(12, 12, 8, 2);
  });
}

function crosshair(): HTMLCanvasElement {
  return canvas(32, 32, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff3355';
    ctx.fillRect(15, 2, 2, 8);
    ctx.fillRect(15, 22, 2, 8);
    ctx.fillRect(2, 15, 8, 2);
    ctx.fillRect(22, 15, 8, 2);
    ctx.fillRect(15, 15, 2, 2);
  });
}

function marker(): HTMLCanvasElement {
  return canvas(52, 52, (ctx) => {
    ctx.strokeStyle = '#ff2d55';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(26, 26, 22, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function shadow(): HTMLCanvasElement {
  return canvas(24, 10, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(12, 5, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function page(): HTMLCanvasElement {
  return canvas(5, 6, (ctx) => {
    ctx.fillStyle = '#fff8e6';
    ctx.fillRect(0, 0, 5, 6);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(1, 2, 3, 1);
  });
}

export function createTextures(scene: Phaser.Scene): void {
  const add = (key: string, c: HTMLCanvasElement) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
  };
  add('mahayana-idle', pixelCanvas(mahayanaIdle(), 3));
  add('mahayana-throw', pixelCanvas(mahayanaThrow(), 3));
  add('mahayana-big', pixelCanvas(mahayanaIdle(), 9));
  add('bandit-0', pixelCanvas(BANDIT_A, 2));
  add('bandit-1', pixelCanvas(banditB(), 2));
  add('bandit-big', pixelCanvas(BANDIT_A, 9));
  add('heart', pixelCanvas(HEART, 3));
  add('book', pixelCanvas(BOOK, 2));
  add('book-icon', pixelCanvas(BOOK, 3));
  add('wall', wallTile());
  add('floor-a', floorTile(false));
  add('floor-b', floorTile(true));
  add('exit', exitTile());
  add('crosshair', crosshair());
  add('marker', marker());
  add('shadow', shadow());
  add('page', page());
}
