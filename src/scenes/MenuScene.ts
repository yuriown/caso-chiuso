import Phaser from 'phaser';
import { DIFFICULTY_LABEL, Difficulty, GameSettings, HEIGHT, Mode, WIDTH } from '../game/config';
import { audio } from '../game/audio';
import { Button, button, text } from '../game/ui';
import { isTouchDevice } from '../game/joystick';

const DIFFICULTIES: Difficulty[] = ['facil', 'normal', 'dificil'];

export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = 'normal';

  constructor() {
    super('Menu');
  }

  create(): void {
    this.input.setDefaultCursor('default');
    this.difficulty = (this.registry.get('difficulty') as Difficulty | undefined) ?? 'normal';

    // fundo com estantes de livros desfocadas
    const g = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      g.fillStyle(Phaser.Display.Color.HSVToRGB(Math.random(), 0.5, 0.35).color, 0.35);
      g.fillRect(Math.random() * WIDTH, Math.random() * HEIGHT, 10 + Math.random() * 14, 40 + Math.random() * 30);
    }

    text(this, WIDTH / 2, 70, 'CASO CHIUSO!', 72, '#f6d55c').setStroke('#3b2a00', 8);
    text(this, WIDTH / 2, 128, 'Mahayana, advogada contra o crime', 26, '#b7acff');

    const lawyer = this.add.image(170, 400, 'mahayana-big');
    this.tweens.add({ targets: lawyer, y: 392, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const bandit = this.add.image(WIDTH - 160, 420, 'bandit-big').setFlipX(true);
    this.tweens.add({ targets: bandit, x: WIDTH - 150, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    text(this, 170, 540, 'Mahayana', 22, '#f6d55c');
    text(this, WIDTH - 160, 540, 'O Bandido', 22, '#ff8a9a');

    const start = (mode: Mode) => {
      const settings: GameSettings = { mode, difficulty: this.difficulty };
      this.registry.set('difficulty', this.difficulty);
      this.registry.set('score', { advogada: 0, bandido: 0 });
      audio.startMusic();
      this.scene.start('Game', settings);
    };

    text(this, WIDTH / 2, 190, 'Escolha o modo', 20, '#cccccc');
    button(this, WIDTH / 2, 240, '1P  ·  Ser a Mahayana', () => start('advogada-vs-cpu'));
    button(this, WIDTH / 2, 300, '1P  ·  Ser o Bandido', () => start('bandido-vs-cpu'));
    button(this, WIDTH / 2, 360, '2P  ·  Mahayana x Bandido', () => start('versus'));

    text(this, WIDTH / 2, 425, 'Dificuldade da CPU', 20, '#cccccc');
    const diffButtons: Button[] = DIFFICULTIES.map((d, i) =>
      button(this, WIDTH / 2 - 130 + i * 130, 470, DIFFICULTY_LABEL[d], () => {
        this.difficulty = d;
        diffButtons.forEach((b, j) => b.setSelected(DIFFICULTIES[j] === d));
      }, 120),
    );
    diffButtons.forEach((b, j) => b.setSelected(DIFFICULTIES[j] === this.difficulty));

    const touch = isTouchDevice();
    const help = touch
      ? [
          'Mahayana: toque no labirinto para arremessar livros.',
          'Bandido: arraste o analógico para fugir pela SAÍDA verde.',
          '3 livradas e o bandido está condenado!   ·   II: pausa',
        ]
      : [
          'Mahayana: mire com o mouse e clique para arremessar livros.',
          'Bandido: WASD ou setas. Fuja pela SAÍDA verde antes do tempo acabar.',
          '3 livradas e o bandido está condenado!   ·   M: som   ·   P/Esc: pausa',
        ];
    help.forEach((line, i) => text(this, WIDTH / 2, 610 + i * 30, line, 17, '#d9d2ff'));

    if (touch && this.scale.fullscreen.available && !this.scale.isFullscreen) {
      const full = button(this, WIDTH - 110, 36, '⛶ Tela cheia', () => {}, 190);
      // o navegador so libera tela cheia dentro do proprio toque
      full.container.on('pointerup', () => {
        this.scale.startFullscreen();
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        orientation.lock?.('landscape').catch(() => {});
        full.container.setVisible(false);
      });
    }

    this.input.once('pointerdown', () => audio.unlock());
  }
}
