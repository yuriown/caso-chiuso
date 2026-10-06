import Phaser from 'phaser';
import { GameSettings, HEIGHT, WIDTH } from '../game/config';
import { button, text } from '../game/ui';
import { isTouchDevice } from '../game/joystick';

export interface EndData {
  settings: GameSettings;
  winner: 'advogada' | 'bandido';
  reason: string;
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(data: EndData): void {
    this.input.setDefaultCursor('default');
    const score = this.registry.get('score') as { advogada: number; bandido: number };

    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, 600, 400, 0x1b1733).setStrokeStyle(4, 0x6a60a3);

    const lawyerWon = data.winner === 'advogada';
    text(this, WIDTH / 2, 210, lawyerWon ? 'CASO CHIUSO!' : 'ESCAPOU!', 56, lawyerWon ? '#f6d55c' : '#ff8a9a');
    this.add.image(WIDTH / 2, 300, lawyerWon ? 'mahayana-throw' : 'bandit-0').setScale(lawyerWon ? 1.2 : 2);
    text(this, WIDTH / 2, 375, data.reason, 20, '#d9d2ff');
    text(this, WIDTH / 2, 415, `Mahayana ${score.advogada}  x  ${score.bandido} Bandido`, 26);

    const again = () => {
      this.scene.stop();
      this.scene.stop('Game');
      this.scene.start('Game', data.settings);
    };
    const menu = () => {
      this.scene.stop('Game');
      this.scene.start('Menu');
    };
    const touch = isTouchDevice();
    button(this, WIDTH / 2 - 130, 480, touch ? 'Revanche' : 'Revanche (Enter)', again, 240);
    button(this, WIDTH / 2 + 130, 480, touch ? 'Menu' : 'Menu (Esc)', menu, 240);
    this.input.keyboard?.once('keydown-ENTER', again);
    this.input.keyboard?.once('keydown-ESC', menu);
  }
}
