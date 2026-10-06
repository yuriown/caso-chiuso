import Phaser from 'phaser';
import { Direction, toDirection8 } from './direction';

export interface JoystickOptions {
  /** onde fica o analogico parado */
  restX: number;
  restY: number;
  radius?: number;
  /** se o toque pode comecar neste ponto */
  zone: (p: Phaser.Input.Pointer) => boolean;
  /** limites para o centro quando ele nasce onde o dedo tocou */
  bounds: Phaser.Geom.Rectangle;
}

/** Analogico virtual: nasce onde o dedo toca e segue o dedo enquanto ele arrasta. */
export class VirtualJoystick {
  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private radius: number;
  private value = { x: 0, y: 0 };
  enabled = true;

  constructor(scene: Phaser.Scene, private opts: JoystickOptions) {
    this.radius = opts.radius ?? 56;
    this.base = scene.add
      .circle(opts.restX, opts.restY, this.radius, 0xffffff, 0.12)
      .setStrokeStyle(3, 0xffffff, 0.45)
      .setDepth(90);
    this.knob = scene.add
      .circle(opts.restX, opts.restY, this.radius * 0.45, 0xff8a9a, 0.55)
      .setStrokeStyle(3, 0xffffff, 0.7)
      .setDepth(91);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('pointerupoutside', this.onUp, this);
    });
  }

  /** true se este toque e do analogico (para nao virar arremesso). */
  owns(p: Phaser.Input.Pointer): boolean {
    return this.pointerId === p.id;
  }

  get direction(): Direction {
    return toDirection8(this.value.x, this.value.y);
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.enabled || this.pointerId !== null || over.length || !this.opts.zone(p)) return;
    this.pointerId = p.id;
    const b = this.opts.bounds;
    const x = Phaser.Math.Clamp(p.x, b.left + this.radius, b.right - this.radius);
    const y = Phaser.Math.Clamp(p.y, b.top + this.radius, b.bottom - this.radius);
    this.base.setPosition(x, y).setAlpha(1);
    this.knob.setPosition(x, y);
    this.onMove(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== p.id) return;
    let ox = p.x - this.base.x;
    let oy = p.y - this.base.y;
    const d = Math.hypot(ox, oy);
    if (d > this.radius) {
      ox = (ox / d) * this.radius;
      oy = (oy / d) * this.radius;
    }
    this.knob.setPosition(this.base.x + ox, this.base.y + oy);
    this.value = { x: ox / this.radius, y: oy / this.radius };
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== p.id) return;
    this.release();
  }

  release(): void {
    this.pointerId = null;
    this.value = { x: 0, y: 0 };
    this.base.setPosition(this.opts.restX, this.opts.restY);
    this.knob.setPosition(this.opts.restX, this.opts.restY);
  }
}

/** Celular/tablet: tela de toque como entrada principal. */
export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}
