import Phaser from 'phaser';
import { DIFFICULTY_LABEL, Difficulty, GameSettings, HEIGHT, Mode, WIDTH } from '../game/config';
import { audio } from '../game/audio';
import { Button, button, text } from '../game/ui';
import { isTouchDevice } from '../game/joystick';
import { SECRET_CODE, SECRET_TAPS, SECRET_TAP_GAP, fugitive } from '../game/fugitive';

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
    const who = fugitive(this.registry);
    const bandit = this.add.image(WIDTH - 160, 420, who.big).setFlipX(who.flip);
    this.tweens.add({ targets: bandit, x: WIDTH - 150, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    text(this, 170, 540, 'Mahayana', 22, '#f6d55c');
    const banditName = text(this, WIDTH - 160, 540, who.label === 'Bandido' ? 'O Bandido' : who.label, 22, '#ff8a9a');

    // codigo secreto: digitar "fazoele" (ou tocar 13 vezes no bandido, no celular)
    // troca o bandido pelo Lula; repetir desfaz
    const toggleSecret = () => {
      this.registry.set('segredo', !this.registry.get('segredo'));
      const now = fugitive(this.registry);
      bandit.setTexture(now.big).setFlipX(now.flip);
      banditName.setText(now.label === 'Bandido' ? 'O Bandido' : now.label);
      nameButtons();
      audio.unlock();
      audio.fanfare(true);
      const msg = text(this, WIDTH / 2, 560, this.registry.get('segredo') ? 'Código secreto ativado!' : 'Código secreto desativado', 22, '#9dffc0').setDepth(10);
      this.tweens.add({ targets: msg, alpha: 0, delay: 1400, duration: 500, onComplete: () => msg.destroy() });
      this.cameras.main.flash(250, 215, 38, 46);
    };

    let typed = '';
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-SECRET_CODE.length);
      if (typed !== SECRET_CODE) return;
      typed = '';
      toggleSecret();
    });

    // toques seguidos: uma pausa maior que SECRET_TAP_GAP recomeca a contagem
    let taps = 0;
    let lastTap = 0;
    bandit.setInteractive();
    bandit.on('pointerdown', () => {
      const now = this.time.now;
      taps = now - lastTap > SECRET_TAP_GAP ? 1 : taps + 1;
      lastTap = now;
      if (taps < SECRET_TAPS) return;
      taps = 0;
      toggleSecret();
    });

    const start = (mode: Mode) => {
      const settings: GameSettings = { mode, difficulty: this.difficulty };
      this.registry.set('difficulty', this.difficulty);
      this.registry.set('score', { advogada: 0, bandido: 0 });
      // adversario novo: a Mahayana da CPU comeca sem conhecer o jogador
      this.registry.remove('modelo');
      audio.startMusic();
      this.scene.start('Game', settings);
    };

    text(this, WIDTH / 2, 190, 'Escolha o modo', 20, '#cccccc');
    button(this, WIDTH / 2, 240, '1P  ·  Ser a Mahayana', () => start('advogada-vs-cpu'));
    const asBandit = button(this, WIDTH / 2, 300, '', () => start('bandido-vs-cpu'));
    const versus = button(this, WIDTH / 2, 360, '', () => start('versus'));
    const nameButtons = () => {
      const f = fugitive(this.registry);
      asBandit.label.setText(`1P  ·  Ser ${f.name}`);
      versus.label.setText(`2P  ·  Mahayana x ${f.label}`);
    };
    nameButtons();

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
