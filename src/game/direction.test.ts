import { describe, expect, it } from 'vitest';
import { toDirection8 } from './direction';

describe('toDirection8', () => {
  it('ignora toque perto do centro', () => {
    expect(toDirection8(0.1, -0.1)).toEqual({ dx: 0, dy: 0 });
  });

  it('vira uma das 8 direcoes do teclado', () => {
    expect(toDirection8(1, 0)).toEqual({ dx: 1, dy: 0 });
    expect(toDirection8(0, -0.8)).toEqual({ dx: 0, dy: -1 });
    expect(toDirection8(-0.6, 0.6)).toEqual({ dx: -1, dy: 1 });
    // quase reto para cima continua reto: nao raspa na quina
    expect(toDirection8(0.2, -0.9)).toEqual({ dx: 0, dy: -1 });
  });
});
