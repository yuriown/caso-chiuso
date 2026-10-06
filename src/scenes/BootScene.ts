import Phaser from 'phaser';
import { createTextures } from '../game/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createTextures(this);
    this.registry.set('score', { advogada: 0, bandido: 0 });
    this.scene.start('Menu');
  }
}
