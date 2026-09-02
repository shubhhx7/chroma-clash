/**
 * Development debug HUD (F3): FPS, viewport metrics, DPR, device profile,
 * safe areas, orientation, fighter states, health, active attack, plus
 * world-space hitbox/hurtbox/bounds overlay.
 */
import Phaser from 'phaser';
import type { Fighter } from '../entities/Fighter';
import type { LogicalViewport } from '../responsive/ResponsiveViewport';
import type { SafeAreaInsets } from '../responsive/SafeAreaService';
import type { DeviceProfile } from '../responsive/DeviceProfile';
import { GROUND_Y } from '../config/constants';

export class DebugHUD {
  readonly text: Phaser.GameObjects.Text;
  readonly worldGraphics: Phaser.GameObjects.Graphics;
  private enabled = false;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(8, 8, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '11px',
        color: '#8dff9d',
        backgroundColor: 'rgba(4,10,18,0.72)',
        padding: { x: 6, y: 4 },
      })
      .setVisible(false)
      .setDepth(1000);
    this.worldGraphics = scene.add.graphics().setVisible(false).setDepth(999);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    this.text.setVisible(this.enabled);
    this.worldGraphics.setVisible(this.enabled);
    return this.enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  layoutTextPosition(safeTop: number, barBottomY: number): void {
    this.text.setPosition(8, Math.max(safeTop + 8, barBottomY + 8));
  }

  update(info: {
    fps: number;
    viewport: LogicalViewport;
    dpr: number;
    profile: DeviceProfile;
    safe: SafeAreaInsets;
    orientation: string;
    player: Fighter;
    enemy: Fighter;
    stageBounds: { minX: number; maxX: number };
  }): void {
    if (!this.enabled) return;
    const { viewport: v, player, enemy } = info;
    const lines = [
      `FPS ${info.fps.toFixed(0)}  DPR ${info.dpr.toFixed(2)}  ${info.profile.kind}${info.profile.isTouch ? ' touch' : ''}  ${info.orientation}`,
      `css ${v.cssWidth.toFixed(0)}x${v.cssHeight.toFixed(0)}  logical ${v.viewWidth.toFixed(0)}x${v.viewHeight.toFixed(0)}  layout ${v.layoutWidth.toFixed(0)}x${v.layoutHeight}  zoom ${v.zoom.toFixed(3)}`,
      `safe t${info.safe.top.toFixed(0)} r${info.safe.right.toFixed(0)} b${info.safe.bottom.toFixed(0)} l${info.safe.left.toFixed(0)}  stage [${info.stageBounds.minX.toFixed(0)}, ${info.stageBounds.maxX.toFixed(0)}]`,
      `KAIRO  ${player.stateMachine.current}  anim=${player.anims.currentName}:${player.anims.frameIndex}  hp=${player.health}  x=${player.x.toFixed(0)}  atk=${player.activeAttack?.id ?? '-'}`,
      `RAIDER ${enemy.stateMachine.current}  anim=${enemy.anims.currentName}:${enemy.anims.frameIndex}  hp=${enemy.health}  x=${enemy.x.toFixed(0)}  atk=${enemy.activeAttack?.id ?? '-'}`,
      // sprite-geometry QA: cell size, destination render size, scale — these
      // must stay constant per fighter when the animation changes
      ...[player, enemy].map((f) => {
        const fr = f.sprite.frame;
        return (
          `${f.id.toUpperCase().padEnd(6)} cell ${fr.width}x${fr.height}  ` +
          `render ${f.sprite.displayWidth.toFixed(0)}x${f.sprite.displayHeight.toFixed(0)}  ` +
          `scale ${Math.abs(f.sprite.scaleX).toFixed(3)}  tex ${f.sprite.texture.key}`
        );
      }),
    ];
    this.text.setText(lines.join('\n'));

    const g = this.worldGraphics;
    g.clear();
    // stage bounds
    g.lineStyle(1, 0x3aa0ff, 0.8);
    g.strokeRect(info.stageBounds.minX, 0, info.stageBounds.maxX - info.stageBounds.minX, 720);
    // shared ground baseline (feet anchor for every state)
    g.lineStyle(1, 0x00e0ff, 0.9);
    g.lineBetween(info.stageBounds.minX - 100, GROUND_Y, info.stageBounds.maxX + 100, GROUND_Y);
    for (const f of [player, enemy]) {
      const hurt = f.hurtbox();
      g.lineStyle(1, 0x54ff6a, 0.9);
      g.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
      const hit = f.currentHitbox();
      if (hit) {
        g.lineStyle(2, 0xff4d4d, 1);
        g.strokeRect(hit.x, hit.y, hit.w, hit.h);
      }
      // destination render rect + pivot (foot-center origin)
      const b = f.sprite.getBounds();
      g.lineStyle(1, 0xffc94d, 0.7);
      g.strokeRect(b.x, b.y, b.width, b.height);
      g.fillStyle(0xffc94d, 1);
      g.fillCircle(f.sprite.x, f.sprite.y, 4);
    }
  }

  destroy(): void {
    this.text.destroy();
    this.worldGraphics.destroy();
  }
}
