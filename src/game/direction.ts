export interface Direction {
  dx: number;
  dy: number;
}

/**
 * Converte o deslocamento do analogico em uma das 8 direcoes, como o teclado.
 * O labirinto e em grade: direcao "quebrada" faria o bandido raspar nas quinas.
 */
export function toDirection8(x: number, y: number, deadzone = 0.25): Direction {
  const mag = Math.hypot(x, y);
  if (mag < deadzone) return { dx: 0, dy: 0 };
  const sector = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  const angle = sector * (Math.PI / 4);
  return { dx: Math.round(Math.cos(angle)), dy: Math.round(Math.sin(angle)) };
}
