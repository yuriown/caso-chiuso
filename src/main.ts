import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './game/config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { EndScene } from './scenes/EndScene';

async function start() {
  // espera a fonte pixelada para o texto nao nascer com a fonte reserva
  try {
    await Promise.race([document.fonts.load('24px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* sem fonte, segue com monospace */
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#0d0b1a',
    pixelArt: true,
    // 2P no celular: um dedo no analogico e outro arremessando
    input: { activePointers: 3 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MenuScene, GameScene, EndScene],
  });
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

void start();
