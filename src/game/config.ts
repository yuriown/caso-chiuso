export const WIDTH = 960;
export const HEIGHT = 720;

export const TILE = 32;
export const CELLS_W = 12;
export const CELLS_H = 8;
export const GRID_W = CELLS_W * 2 + 1; // 25
export const GRID_H = CELLS_H * 2 + 1; // 17
export const MAZE_X = (WIDTH - GRID_W * TILE) / 2; // 80
export const MAZE_Y = 56;
export const MAZE_BOTTOM = MAZE_Y + GRID_H * TILE; // 600
export const BALCONY_Y = MAZE_BOTTOM + 6;

export const FONT = '"Pixelify Sans", monospace';

export const ROUND_SECONDS = 60;
export const BANDIT_LIVES = 3;
export const BANDIT_HALF = 9; // meia caixa de colisao
export const BANDIT_SPEED = 125;
export const HIT_RADIUS = 24;
export const MAX_AMMO = 5;
export const AMMO_REGEN = 1.4;
export const THROW_COOLDOWN = 0.35;
export const STUN_TIME = 0.5;
export const INVULN_TIME = 1.5;

export type Mode = 'advogada-vs-cpu' | 'bandido-vs-cpu' | 'versus';
export type Difficulty = 'facil' | 'normal' | 'dificil';

export interface GameSettings {
  mode: Mode;
  difficulty: Difficulty;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
};

/** Parametros da CPU. */
export const AI = {
  bandit: {
    facil: { speed: 0.82, reactChance: 0.35, reactWindow: 0.3 },
    normal: { speed: 0.95, reactChance: 0.65, reactWindow: 0.45 },
    dificil: { speed: 1.0, reactChance: 0.9, reactWindow: 0.65 },
  },
  lawyer: {
    facil: { interval: 1.5, lead: 0.5, error: 34 },
    normal: { interval: 1.15, lead: 0.8, error: 24 },
    dificil: { interval: 0.8, lead: 1.0, error: 12 },
  },
} as const;

export function flightTime(dist: number): number {
  return 0.35 + dist / 950;
}
