import Phaser from 'phaser';
import { FONT } from './config';
import { audio } from './audio';

export function text(scene: Phaser.Scene, x: number, y: number, value: string, size = 24, color = '#ffffff'): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' })
    .setOrigin(0.5)
    .setShadow(2, 2, '#000000', 0, true, true);
}

export interface Button {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  setSelected(on: boolean): void;
}

export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, width = 380): Button {
  const bg = scene.add.rectangle(0, 0, width, 48, 0x2a2547).setStrokeStyle(3, 0x6a60a3);
  const t = text(scene, 0, 0, label, 22);
  const container = scene.add.container(x, y, [bg, t]).setSize(width, 48);
  let selected = false;
  const paint = (hover: boolean) => {
    bg.setFillStyle(hover || selected ? 0x4a3f8a : 0x2a2547);
    bg.setStrokeStyle(3, selected ? 0xf6d55c : hover ? 0xb7acff : 0x6a60a3);
  };
  container.setInteractive({ useHandCursor: true });
  container.on('pointerover', () => paint(true));
  container.on('pointerout', () => paint(false));
  container.on('pointerdown', () => {
    audio.unlock();
    audio.click();
    onClick();
  });
  return {
    container,
    label: t,
    setSelected(on: boolean) {
      selected = on;
      paint(false);
    },
  };
}
