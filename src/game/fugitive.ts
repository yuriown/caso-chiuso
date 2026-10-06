import type Phaser from 'phaser';

/** O personagem que foge. O codigo secreto "fazoele" no menu troca o bandido pelo Lula. */
export interface Fugitive {
  /** nome nas frases ("o bandido", "o Lula") */
  name: string;
  /** rotulo no placar e no HUD */
  label: string;
  frames: [string, string];
  big: string;
  /** escala no labirinto: o Lula e mais alto que o bandido */
  gameScale: number;
  /** espelhar ao andar para a esquerda (o "PT" sairia de tras para frente) */
  flip: boolean;
}

export const SECRET_CODE = 'fazoele';
/** no celular, sem teclado: tocar no bandido do menu esta quantidade de vezes */
export const SECRET_TAPS = 13;
export const SECRET_TAP_GAP = 1500;

const BANDIT: Fugitive = {
  name: 'o bandido',
  label: 'Bandido',
  frames: ['bandit-0', 'bandit-1'],
  big: 'bandit-big',
  gameScale: 1,
  flip: true,
};

const LULA: Fugitive = {
  name: 'o Lula',
  label: 'Lula',
  frames: ['lula-0', 'lula-1'],
  big: 'lula-big',
  gameScale: 0.6,
  flip: false,
};

export function fugitive(registry: Phaser.Data.DataManager): Fugitive {
  return registry.get('segredo') ? LULA : BANDIT;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
