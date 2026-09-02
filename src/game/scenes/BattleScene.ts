/**
 * Battle orchestration for the three-fight run (Raider -> Guardian -> Vael).
 * Wires focused systems together: arena, fighters, AI, combat, VFX, HUD,
 * input, audio, run state and responsive layout.
 *
 * Rendering model: the main camera shows the world (720 logical units tall,
 * adaptive width); a second UI camera renders HUD/touch controls in CSS-px
 * screen space so safe-area work stays trivial.
 */
import Phaser from 'phaser';
import {
  COMBAT_EVENTS,
  ENERGY_MAX,
  FIGHTER_MIN_GAP,
  GROUND_Y,
  REGISTRY,
  SCENES,
  STAGE_HALF_WIDTH,
} from '../config/constants';
import { computeLogicalViewport, type LogicalViewport } from '../responsive/ResponsiveViewport';
import { SafeAreaService, insetsToWorld, type SafeAreaInsets } from '../responsive/SafeAreaService';
import type { DeviceProfile } from '../responsive/DeviceProfile';
import { ArenaBuilder } from '../arena/ArenaBuilder';
import { Kairo } from '../entities/Kairo';
import { Enemy } from '../entities/Enemy';
import { EnemyAI } from '../ai/EnemyAI';
import { GuardianAI } from '../ai/GuardianAI';
import { RaiderAI } from '../ai/RaiderAI';
import { VaelAI } from '../ai/VaelAI';
import { CombatSystem } from '../combat/CombatSystem';
import { ComboSystem } from '../combat/ComboSystem';
import type { HitEvent } from '../combat/combatTypes';
import { VfxManager } from '../vfx/VfxManager';
import { HitStopController } from '../vfx/HitStopController';
import { CameraFeedback } from '../vfx/CameraFeedback';
import { BattleHUD } from '../ui/BattleHUD';
import { TouchControls } from '../ui/TouchControls';
import { DebugHUD } from '../ui/DebugHUD';
import { OrientationMessage } from '../ui/OrientationMessage';
import { ResultPanel } from '../ui/ResultPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchInput } from '../input/TouchInput';
import { InputRouter } from '../input/InputRouter';
import { InputAction } from '../input/InputAction';
import { FighterStateId } from '../state/FighterState';
import { ENEMY_CONFIGS, KAIRO_CONFIG } from '../data/fighterConfigs';
import { computeScore, rankForScore } from '../data/gameBalance';
import { RunState, type EnemyId, type FightResult } from '../data/runState';
import { audio, type CharacterId } from '../audio/AudioManager';
import { PROCESSED_ANIMATIONS, PROCESSED_STILLS } from '../data/processedAssets';
import { versioned } from '../data/assetVersion';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { animKeyFor } from '../animation/animationKeys';
import { settings } from '../config/settings';
import { TEX } from '../data/assetKeys';
import { EMPTY_INTENT } from '../entities/Fighter';
import { clamp } from '../utils/math';

type Phase = 'intro' | 'fighting' | 'ko';

/** registry key: play the get-up intro after a defeat restart */
const WAS_DEFEATED = 'battle-was-defeated';

export class BattleScene extends Phaser.Scene {
  private run!: RunState;
  private kairo!: Kairo;
  private enemy!: Enemy;
  private enemyAI!: EnemyAI;
  private arena!: ArenaBuilder;
  private combat!: CombatSystem;
  private combo = new ComboSystem();
  private vfx!: VfxManager;
  private hitStop!: HitStopController;
  private cameraFx!: CameraFeedback;
  private hud!: BattleHUD;
  private touchControls!: TouchControls;
  private debugHud!: DebugHUD;
  private sizeWarning = new OrientationMessage();
  private resultPanel: ResultPanel | null = null;
  private settingsPanel!: SettingsPanel;
  private koStinger: Phaser.GameObjects.Image | null = null;
  private koStingerScale = 0.2;
  private bossAura: Phaser.GameObjects.Image | null = null;
  private nameplate: Phaser.GameObjects.Image | null = null;

  private keyboard!: KeyboardInput;
  private touch!: TouchInput;
  private inputRouter!: InputRouter;

  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private viewport!: LogicalViewport;
  private safe: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  private profile!: DeviceProfile;
  private forceTouchControls = false;

  private phase: Phase = 'intro';
  private paused = false;
  private stageBounds = { minX: -STAGE_HALF_WIDTH, maxX: STAGE_HALF_WIDTH };
  private resizeHandler: (() => void) | null = null;

  // round stats (feed the typed FightResult — the panel reads only from it)
  private fightStartMs = 0;
  private fightEndMs = 0;
  private damageTaken = 0;
  private perfectBlocks = 0;
  private maxCombo = 0;
  private hitsLanded = 0;
  private attacksAttempted = 0;
  private lastAttackInstance = 0;
  private fightStartHealth = 100;
  private fightToken = 0;
  private lastTrailInstance = -1;
  private lastSpecialInstance = -1;
  private lastEnemySwingInstance = -1;
  private lastHeavyArcInstance = -1;
  private prevKairoState: FighterStateId | null = null;
  private koHandled = false;

  constructor() {
    super(SCENES.BATTLE);
  }

  /**
   * Lazy-load ONLY the current opponent's strips and unload the previous
   * enemy's — resident texture memory stays bounded to two fighters
   * (mobile GPUs). Kairo/arena/UI/VFX were preloaded by PreloadScene.
   */
  preload(): void {
    const run = this.registry.get(REGISTRY.RUN_STATE) as RunState | undefined;
    const enemyId: EnemyId = run?.enemyId ?? 'raider';
    for (const [key, meta] of Object.entries(PROCESSED_ANIMATIONS)) {
      const m = /^characters\.(raider|guardian|vael)\./.exec(key);
      if (!m) continue;
      if (m[1] === enemyId) {
        if (!this.textures.exists(key)) {
          this.load.spritesheet(key, versioned(meta.url), {
            frameWidth: meta.frameWidth,
            frameHeight: meta.frameHeight,
          });
        }
      } else if (this.textures.exists(key)) {
        this.anims.remove(animKeyFor(key));
        this.textures.remove(key);
      }
    }
  }

  create(): void {
    AnimationRegistry.registerAll(this); // registers the lazily-loaded enemy anims (idempotent)
    this.profile = this.registry.get(REGISTRY.DEVICE_PROFILE) as DeviceProfile;
    // direct battle entry (deep link / automation) gets a default run
    this.run = (this.registry.get(REGISTRY.RUN_STATE) as RunState | undefined) ?? new RunState('chroma-blade', KAIRO_CONFIG.maxHealth);
    this.registry.set(REGISTRY.RUN_STATE, this.run);

    this.phase = 'intro';
    this.paused = false;
    this.koHandled = false;
    this.combo = new ComboSystem();
    this.damageTaken = 0;
    this.perfectBlocks = 0;
    this.maxCombo = 0;
    this.hitsLanded = 0;
    this.attacksAttempted = 0;
    this.lastAttackInstance = 0;
    this.prevKairoState = null;
    this.lastTrailInstance = -1;
    this.lastSpecialInstance = -1;
    this.lastEnemySwingInstance = -1;
    this.lastHeavyArcInstance = -1;
    this.resultPanel = null;
    this.cameras.main.fadeIn(220, 6, 9, 18);

    // ---- world ----
    this.arena = new ArenaBuilder(this);
    this.arena.build();

    const enemyId = this.run.enemyId;
    this.kairo = new Kairo(this, -220, 1);
    this.kairo.modifiers = this.run.modifiers;
    this.kairo.health = this.run.health;
    this.kairo.energy = this.run.energy;
    this.fightStartHealth = this.run.health;
    this.enemy = new Enemy(this, ENEMY_CONFIGS[enemyId], 260, -1);
    this.enemyAI = this.createAI(enemyId);
    this.enemy.attachAI(this.enemyAI);
    this.kairo.sprite.setDepth(10);
    this.enemy.sprite.setDepth(9);
    this.kairo.onSpecialDenied = () => this.onSpecialDenied();

    this.vfx = new VfxManager(this);
    this.vfx.uiIgnored = (obj) => this.uiCamera?.ignore(obj);
    this.bossAura =
      enemyId === 'vael'
        ? this.add.image(0, 0, TEX.VFX_AURA_CREST).setVisible(false).setDepth(8).setBlendMode(Phaser.BlendModes.ADD)
        : null;
    this.hitStop = new HitStopController(this);
    this.cameraFx = new CameraFeedback(this.cameras.main);
    this.debugHud = new DebugHUD(this); // world graphics part
    const worldObjects = [...this.children.list].filter((o) => o !== this.debugHud.text);

    // ---- input ----
    this.keyboard = new KeyboardInput(this);
    this.touch = new TouchInput();
    this.inputRouter = new InputRouter([this.keyboard, this.touch]);

    // ---- UI (screen space) ----
    this.hud = new BattleHUD(this, KAIRO_CONFIG.displayName, this.enemy.config.displayName, () => this.togglePause());
    this.touchControls = new TouchControls(this, this.touch);
    this.touchControls.setVisible(this.profile.wantsTouchControls);
    this.settingsPanel = new SettingsPanel(
      this,
      () => this.togglePause(),
      () => this.retryFight(),
      () => this.goToMenu(),
    );
    this.koStinger = this.add.image(0, 0, TEX.OVERLAY_KO).setVisible(false).setDepth(400);
    this.nameplate = enemyId === 'vael' ? this.add.image(0, 0, TEX.VAEL_NAMEPLATE).setVisible(false).setDepth(400) : null;
    const uiObjects: Phaser.GameObjects.GameObject[] = [
      this.hud.root,
      this.touchControls.root,
      this.debugHud.text,
      this.settingsPanel.root,
      this.koStinger,
    ];
    if (this.nameplate) uiObjects.push(this.nameplate);

    // ---- cameras ----
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.cameras.main.ignore(uiObjects);
    this.uiCamera.ignore(worldObjects);

    // ---- combat events ----
    this.combat = new CombatSystem(this.events, this.kairo, this.enemy, () => this.time.now);
    this.events.on(COMBAT_EVENTS.HIT_CONFIRMED, this.onHitConfirmed, this);
    this.events.on(COMBAT_EVENTS.HIT_BLOCKED, this.onHitBlocked, this);
    this.events.on(COMBAT_EVENTS.GUARD_BREAK, this.onGuardBreak, this);
    this.events.on(COMBAT_EVENTS.PARRY, this.onParry, this);
    this.events.on(COMBAT_EVENTS.KO, this.onKO, this);

    // ---- responsive ----
    this.refreshLayout();
    this.resizeHandler = () => this.refreshLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());

    // ---- intro ----
    this.hud.setPlayerHealth(this.kairo.health / this.run.maxHealth);
    if (this.registry.get(WAS_DEFEATED) === true) {
      this.registry.set(WAS_DEFEATED, false);
      this.kairo.anims.play('getup', true);
    }
    audio.resetFight();
    audio.music(enemyId);
    if (enemyId === 'vael') {
      this.playBossIntro();
    } else {
      this.hud.playIntro(() => this.beginFighting());
    }

    if (import.meta.env.DEV) this.logOverlayAssets();
    this.fightToken = Math.floor(Math.random() * 1e9);
    this.publishTestHook();
  }

  /** dev proof: which file each overlay actually loaded, at native size */
  private logOverlayAssets(): void {
    for (const [label, key] of [
      ['READY', TEX.OVERLAY_READY],
      ['FIGHT', TEX.OVERLAY_FIGHT],
      ['KO', TEX.OVERLAY_KO],
    ] as const) {
      const still = (PROCESSED_STILLS as Record<string, { url: string; source: string; passthrough?: boolean } | undefined>)[key];
      const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
      console.log(
        `${label} asset: ${still?.url ?? key} ${src.width}x${src.height}` +
          ` (source ${still?.source ?? '?'}${still?.passthrough ? ', verbatim copy' : ''})`,
      );
    }
  }

  private createAI(enemyId: EnemyId): EnemyAI {
    if (enemyId === 'guardian') return new GuardianAI(this.enemy, this.kairo);
    if (enemyId === 'vael') {
      const ai = new VaelAI(this.enemy, this.kairo);
      ai.onPhaseChange = () => this.onVaelPhaseChange();
      return ai;
    }
    return new RaiderAI(this.enemy, this.kairo);
  }

  private beginFighting(): void {
    this.phase = 'fighting';
    this.fightStartMs = this.time.now; // timer starts when FIGHT completes
  }

  /** Boss intro: nameplate reveal, then FINAL FIGHT, then the timer starts. */
  private playBossIntro(): void {
    const plate = this.nameplate;
    if (!plate) {
      this.hud.playIntro(() => this.beginFighting());
      return;
    }
    plate.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: plate,
      alpha: 1,
      duration: 350,
      yoyo: true,
      hold: 900,
      onComplete: () => {
        plate.setVisible(false);
        this.hud.playFinalFightIntro(() => this.beginFighting());
      },
    });
    audio.voice('vael', 'taunt');
  }

  private onShutdown(): void {
    if (this.resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.off(COMBAT_EVENTS.HIT_CONFIRMED, this.onHitConfirmed, this);
    this.events.off(COMBAT_EVENTS.HIT_BLOCKED, this.onHitBlocked, this);
    this.events.off(COMBAT_EVENTS.GUARD_BREAK, this.onGuardBreak, this);
    this.events.off(COMBAT_EVENTS.PARRY, this.onParry, this);
    this.events.off(COMBAT_EVENTS.KO, this.onKO, this);
    this.hitStop.reset();
    this.sizeWarning.destroy();
    this.resultPanel?.destroy();
  }

  /** Recompute cameras, arena, HUD and bounds. Never restarts the fight. */
  private refreshLayout(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = this.scale.width / dpr;
    const cssHeight = this.scale.height / dpr;
    this.viewport = computeLogicalViewport(cssWidth, cssHeight);

    const cam = this.cameras.main;
    cam.setZoom(this.viewport.zoom * dpr);
    cam.centerOn(0, 360);

    this.uiCamera.setSize(this.scale.width, this.scale.height);
    this.uiCamera.setZoom(dpr);
    this.uiCamera.centerOn(cssWidth / 2, cssHeight / 2);

    const safeService = this.registry.get(REGISTRY.SAFE_AREA) as SafeAreaService;
    this.safe = safeService.read();

    this.arena.layout(this.viewport.viewWidth, this.viewport.viewHeight, 0, 360);

    const worldSafe = insetsToWorld(this.safe, this.viewport.zoom);
    const halfVisible = this.viewport.viewWidth / 2;
    const margin = 70;
    const halfStage = Math.min(STAGE_HALF_WIDTH, halfVisible - margin - Math.max(worldSafe.left, worldSafe.right));
    this.stageBounds = { minX: -halfStage, maxX: halfStage };
    this.kairo.setStageBounds(this.stageBounds.minX, this.stageBounds.maxX);
    this.enemy.setStageBounds(this.stageBounds.minX, this.stageBounds.maxX);

    this.hud.layout(cssWidth, cssHeight, this.safe);
    this.touchControls.layout(cssWidth, cssHeight, this.safe, this.profile.controlSizePx);
    this.settingsPanel.setPosition(cssWidth / 2, cssHeight / 2);
    this.resultPanel?.setPosition(cssWidth / 2, cssHeight / 2);
    if (this.koStinger) {
      // Medium KO stinger, measured on the VISIBLE artwork (the provided PNG
      // carries wide transparent margins, so scaling by the canvas width would
      // under-size the art). ~22% of viewport width on desktop, ~28% narrow.
      const still = (PROCESSED_STILLS as Record<string, { contentRect?: { w: number }; width?: number } | undefined>)[
        TEX.OVERLAY_KO
      ];
      const contentW = still?.contentRect?.w ?? still?.width ?? this.koStinger.width;
      this.koStingerScale = Math.min(1, (cssWidth * (cssWidth < 900 ? 0.28 : 0.22)) / Math.max(1, contentW));
      this.koStinger.setScale(this.koStingerScale).setPosition(cssWidth / 2, cssHeight * 0.33);
    }
    if (this.nameplate) {
      const tex = this.textures.get(TEX.VAEL_NAMEPLATE).getSourceImage() as { width: number };
      this.nameplate.setScale(Math.min(420, cssWidth * 0.42) / tex.width).setPosition(cssWidth / 2, cssHeight * 0.3);
    }
    this.debugHud.layoutTextPosition(this.safe.top, this.safe.top + 16 + this.hud.healthBarBottomY);
    this.sizeWarning.update(cssWidth, cssHeight, this.profile.isTouch);
  }

  // ------------------------------------------------------------- feedback

  private onHitConfirmed(hit: HitEvent): void {
    const fromPlayer = hit.attackerId === this.kairo.id;
    this.vfx.hitSpark(hit.contactX, hit.contactY, fromPlayer);
    if (!fromPlayer) {
      if (this.enemy.id === 'guardian') this.vfx.hammerImpact(hit.contactX, hit.contactY);
      else if (this.enemy.id === 'vael' && hit.attack.id === 'vael-special') this.vfx.riftBurst(hit.contactX, hit.contactY);
      else this.vfx.slashArc(hit.contactX, hit.contactY, this.enemy.facing);
    }
    this.hitStop.trigger(hit.attack.hitStopMs);
    const heavyHit = hit.damage >= 16;
    this.cameraFx.hitShake(heavyHit ? 0.007 : 0.004, heavyHit ? 130 : 90);
    // armored targets clang; the Guardian's hammer shakes the ground
    const targetId = (hit.targetId as CharacterId) ?? 'kairo';
    if (targetId === 'guardian') audio.sfx('hit-armor');
    else audio.sfx(heavyHit ? 'hit-heavy' : 'hit');
    if (!fromPlayer && this.enemy.id === 'guardian') audio.sfx('hammer-ground');
    if (heavyHit) audio.duckMusic();
    audio.voice(targetId, heavyHit ? 'hurt-heavy' : 'hurt-light');
    if (fromPlayer) {
      this.hitsLanded++;
      this.hud.setEnemyHealth(this.enemy.health / this.enemy.config.maxHealth);
      const combo = this.combo.registerPlayerHit();
      this.maxCombo = Math.max(this.maxCombo, combo);
      this.hud.setCombo(combo);
    } else {
      this.damageTaken += hit.damage;
      this.hud.setPlayerHealth(this.kairo.health / this.run.maxHealth);
      this.combo.registerPlayerHurt();
      this.hud.setCombo(0);
      if (settings.get().vibration && navigator.vibrate) navigator.vibrate(30);
    }
  }

  private onHitBlocked(e: { targetId: string; contactX: number; contactY: number }): void {
    this.vfx.blockShield(e.contactX, e.contactY);
    this.hitStop.trigger(45);
    audio.sfx('block');
    if (e.targetId === this.kairo.id) {
      this.hud.setPlayerHealth(this.kairo.health / this.run.maxHealth);
    } else {
      this.hud.setEnemyHealth(this.enemy.health / this.enemy.config.maxHealth);
    }
  }

  private onGuardBreak(e: { targetId: string; contactX: number; contactY: number }): void {
    this.vfx.blockShield(e.contactX, e.contactY);
    this.vfx.koBurst(e.contactX, e.contactY);
    this.hitStop.trigger(110);
    this.cameraFx.hitShake(0.006, 120);
    audio.sfx('guard-break');
  }

  private onParry(e: { targetId: string; contactX: number; contactY: number }): void {
    this.vfx.blockShield(e.contactX, e.contactY);
    this.vfx.parryFlash(e.contactX, e.contactY);
    this.hitStop.trigger(120);
    this.cameraFx.hitShake(0.006, 110);
    audio.sfx('parry');
    if (e.targetId === this.kairo.id) this.perfectBlocks++;
  }

  private onVaelPhaseChange(): void {
    this.vfx.riftRing(this.enemy.x, GROUND_Y - 160);
    this.enemy.sprite.setTint(0xd9b0ff);
    this.cameraFx.hitShake(0.008, 260);
    audio.sfx('rift');
    audio.voice('vael', 'taunt');
    // enraged: persistent aura crest burns at his feet from here on
    if (this.bossAura) {
      this.bossAura.setVisible(true).setAlpha(0.55).setScale(2.4);
      this.tweens.add({ targets: this.bossAura, alpha: 0.3, duration: 520, yoyo: true, repeat: -1 });
    }
  }

  private onSpecialDenied(): void {
    audio.sfx('ui-denied');
    this.hud.flashEnergyBar();
  }

  // ------------------------------------------------------------- KO / result

  private onKO(outcome: 'player-wins' | 'enemy-wins'): void {
    if (this.koHandled) return; // no duplicate result transition
    this.koHandled = true;
    this.phase = 'ko';
    this.fightEndMs = this.time.now; // timer stops on the decisive hit
    this.cameraFx.koShake();
    audio.sfx('ko');
    audio.stopMusic(1.2);
    const loserId = (outcome === 'player-wins' ? this.enemy.id : 'kairo') as CharacterId;
    audio.voice(loserId, 'defeat');
    if (outcome === 'player-wins' && this.enemy.id === 'vael') {
      this.vfx.bossDefeat(this.enemy.x, GROUND_Y); // final-boss crystal pillar send-off
      this.bossAura?.setVisible(false);
    }
    // defeat thud when the falling body reaches the ground, not at anim start
    this.time.delayedCall(550, () => audio.sfx('land'));
    const victory = outcome === 'player-wins';
    const loser = victory ? this.enemy : this.kairo;
    const winner = victory ? this.kairo : this.enemy;
    this.vfx.koBurst(loser.x, GROUND_Y - 150);
    if (!winner.isDefeated) winner.stateMachine.transition(FighterStateId.VICTORY, true);
    if (!victory) this.registry.set(WAS_DEFEATED, true);
    this.touchControls.setVisible(false);

    // compact KO stinger (~700ms), then the code-driven result panel
    const stinger = this.koStinger;
    if (stinger) {
      // The provided PNG is rendered exactly as authored: full opacity, normal
      // blend, no tint. ONLY the display size animates (a short pop), then it
      // hides — no opacity fade is applied to the artwork.
      const target = this.koStingerScale;
      stinger
        .setVisible(true)
        .setAlpha(1)
        .clearTint()
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setScale(target * 0.7);
      this.tweens.add({ targets: stinger, scaleX: target, scaleY: target, duration: 170, ease: 'Back.easeOut' });
      this.time.delayedCall(830, () => stinger.setVisible(false));
    }
    this.time.delayedCall(1050, () => this.showResult(victory));
  }

  private buildResult(victory: boolean): FightResult {
    const elapsedMs = Math.max(0, this.fightEndMs - this.fightStartMs);
    const score = computeScore({
      victory,
      completionTimeMs: elapsedMs,
      damageTaken: this.damageTaken,
      perfectBlocks: this.perfectBlocks,
      maxCombo: this.maxCombo,
      remainingHealth: Math.max(0, this.kairo.health),
      fightIndex: this.run.fightIndex,
      hitsLanded: this.hitsLanded,
      comboScoreMult: this.run.modifiers.comboScoreMult,
    });
    return {
      outcome: victory ? 'victory' : 'defeat',
      enemyId: this.run.enemyId,
      elapsedMs,
      damageTaken: this.damageTaken,
      perfectBlocks: this.perfectBlocks,
      maxCombo: this.maxCombo,
      hitsLanded: this.hitsLanded,
      attacksAttempted: this.attacksAttempted,
      score,
      rank: rankForScore(score),
    };
  }

  private showResult(victory: boolean): void {
    const result = this.buildResult(victory);
    this.registry.set(REGISTRY.LAST_RESULT, result);
    audio.sfx(victory ? 'victory' : 'defeat');

    if (victory) {
      this.run.health = this.kairo.health;
      this.run.energy = this.kairo.energy;
      this.run.recordFightResult(result);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = this.scale.width / dpr;
    const cssHeight = this.scale.height / dpr;

    if (victory && this.run.isFinalFight) {
      // RUN COMPLETE — final totals with rank recomputed over the whole run
      const finalRank = rankForScore(Math.round(this.run.totals.score / 3));
      this.resultPanel = new ResultPanel(
        this,
        'RUN COMPLETE',
        { ...result, rank: finalRank },
        [
          { label: 'FIGHT AGAIN', handler: () => this.fightAgain() },
          { label: 'MAIN MENU', handler: () => this.goToMenu() },
        ],
        this.run.totals,
      );
    } else if (victory) {
      this.resultPanel = new ResultPanel(this, 'ROUND CLEAR', result, [
        { label: 'CONTINUE', handler: () => this.continueRun() },
      ]);
    } else {
      this.resultPanel = new ResultPanel(this, 'DEFEAT', result, [
        { label: 'RETRY', handler: () => this.retryFight() },
        { label: 'MAIN MENU', handler: () => this.goToMenu() },
      ]);
    }
    this.resultPanel.setPosition(cssWidth / 2, cssHeight / 2);
    this.cameras.main.ignore(this.resultPanel.root);
    this.publishTestHook();
  }

  private continueRun(): void {
    audio.sfx('ui-select');
    this.run.advance();
    this.inputRouter.reset();
    this.hitStop.reset();
    this.scene.start(SCENES.UPGRADE);
  }

  private fightAgain(): void {
    audio.sfx('ui-select');
    const fresh = new RunState(this.run.weaponId, KAIRO_CONFIG.maxHealth);
    this.registry.set(REGISTRY.RUN_STATE, fresh);
    this.inputRouter.reset();
    this.hitStop.reset();
    this.scene.restart();
  }

  private retryFight(): void {
    // restore health to the fight-start snapshot; upgrades stay
    this.run.health = this.fightStartHealth;
    this.inputRouter.reset();
    this.hitStop.reset();
    this.scene.restart();
  }

  private goToMenu(): void {
    audio.stopMusic(0.4);
    this.registry.set(REGISTRY.RUN_STATE, undefined);
    this.inputRouter.reset();
    this.hitStop.reset();
    this.scene.start(SCENES.MENU);
  }

  private togglePause(): void {
    if (this.phase === 'ko') return;
    this.paused = !this.paused;
    this.settingsPanel.setVisible(this.paused);
    this.touchControls.setVisible(!this.paused && (this.profile.wantsTouchControls || this.forceTouchControls));
    audio.sfx('ui-select');
  }

  // ------------------------------------------------------------- update

  override update(_time: number, delta: number): void {
    this.inputRouter.update();

    if (this.inputRouter.justPressed(InputAction.DEBUG_TOGGLE)) this.debugHud.toggle();
    if (this.inputRouter.justPressed(InputAction.PAUSE)) this.togglePause();
    if (this.inputRouter.justPressed(InputAction.RESTART)) {
      this.retryFight();
      return;
    }
    if (import.meta.env.DEV && this.inputRouter.justPressed(InputAction.ASSET_GALLERY)) {
      this.scene.start(SCENES.ASSET_GALLERY);
      return;
    }
    if (this.debugHud.isEnabled && this.input.keyboard?.checkDown(this.input.keyboard.addKey('T'), 500)) {
      this.forceTouchControls = !this.forceTouchControls;
      this.touchControls.setVisible(this.profile.wantsTouchControls || this.forceTouchControls);
    }

    this.hitStop.update(delta);

    if (!this.paused && !this.hitStop.isFrozen) {
      if (this.phase === 'fighting') {
        this.kairo.applyInput(this.inputRouter);
      } else {
        this.kairo.intent = { ...EMPTY_INTENT };
      }

      this.kairo.update(delta);
      this.enemy.update(delta);
      if (this.bossAura?.visible) this.bossAura.setPosition(this.enemy.x, GROUND_Y - 40);
      this.trackJumpSfx();
      this.trackAttackAttempts();
      this.spawnSwingFx();
      this.faceOpponents();
      this.separateFighters();

      if (this.phase === 'fighting') {
        this.combat.update();
        this.combo.update(delta);
      }
    }

    this.hud.setPlayerEnergy(this.kairo.energy / ENERGY_MAX);
    this.touchControls.setSpecialReady(this.kairo.canUseSpecial());

    this.inputRouter.postUpdate();
    this.publishTestHook();

    this.debugHud.update({
      fps: this.game.loop.actualFps,
      viewport: this.viewport,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      profile: this.profile,
      safe: this.safe,
      orientation: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
      player: this.kairo,
      enemy: this.enemy,
      stageBounds: this.stageBounds,
    });
  }

  private trackJumpSfx(): void {
    const state = this.kairo.stateMachine.current;
    if (state !== this.prevKairoState) {
      if (state === FighterStateId.JUMP) audio.sfx('jump');
      else if (this.prevKairoState === FighterStateId.JUMP && state === FighterStateId.IDLE) {
        audio.sfx('land');
        this.vfx.playAnim(TEX.VFX_LANDING_DUST, this.kairo.x, GROUND_Y - 35, 0.45);
      }
      this.prevKairoState = state;
    }
  }

  private trackAttackAttempts(): void {
    if (this.kairo.attackInstanceId !== this.lastAttackInstance) {
      this.attacksAttempted += this.kairo.attackInstanceId - this.lastAttackInstance;
      this.lastAttackInstance = this.kairo.attackInstanceId;
    }
  }

  /** Blade trail + special burst for Kairo; swing sfx + rift telegraph for enemies. */
  private spawnSwingFx(): void {
    const attack = this.kairo.activeAttack;
    if (attack) {
      const frame = this.kairo.anims.frameIndex;
      // heavy slash: crescent arc on the first active frame, cross-flash on
      // the last — frame-synced to the swing, one of each per swing
      if (attack.id === 'kairo-heavy') {
        const first = attack.activeFrames[0] ?? 0;
        if (frame >= first && this.kairo.attackInstanceId !== this.lastHeavyArcInstance) {
          this.lastHeavyArcInstance = this.kairo.attackInstanceId;
          this.vfx.heavyArc(this.kairo.x + this.kairo.facing * 150, GROUND_Y - 175, this.kairo.facing);
        }
      }
      if (this.kairo.attackInstanceId !== this.lastTrailInstance && attack.activeFrames.includes(frame)) {
        this.lastTrailInstance = this.kairo.attackInstanceId;
        // NOTE: no runtime swing-trail sprite. The HD attack sheets carry
        // baked slash trails; overlaying a blade-shaped streak here read as a
        // second sword floating away from Kairo's hand.
        audio.sfx(attack.id === 'kairo-heavy' ? 'swing-heavy' : 'swing-light');
        if (attack.id === 'kairo-dash') {
          audio.sfx('dash');
          // kicked-up dust trailing the lunge
          this.vfx.playAnim(TEX.VFX_DASH_DUST, this.kairo.x - this.kairo.facing * 90, GROUND_Y - 40, 0.5, this.kairo.facing === -1);
        }
        // effort barks: light ~28%, kick 50%, heavy 65% (special always, below)
        if (attack.id === 'kairo-heavy') audio.voice('kairo', 'attack', 0.65);
        else if (attack.id === 'kairo-kick') audio.voice('kairo', 'attack', 0.5);
        else audio.voice('kairo', 'attack', 0.28);
      }
      if (attack.id === 'kairo-special' && this.kairo.attackInstanceId !== this.lastSpecialInstance) {
        this.lastSpecialInstance = this.kairo.attackInstanceId;
        this.vfx.chromaBurst(this.kairo.x + this.kairo.facing * 120, GROUND_Y - 170);
        this.cameraFx.hitShake(0.008, 160);
        audio.sfx('special');
        audio.voice('kairo', 'special');
      }
    }
    const enemyAttack = this.enemy.activeAttack;
    if (enemyAttack && this.enemy.attackInstanceId !== this.lastEnemySwingInstance) {
      const frame = this.enemy.anims.frameIndex;
      if (enemyAttack.activeFrames.includes(frame)) {
        this.lastEnemySwingInstance = this.enemy.attackInstanceId;
        if (this.enemy.id === 'guardian') audio.sfx('swing-hammer');
        else audio.sfx(enemyAttack.id.endsWith('-heavy') ? 'swing-heavy' : 'swing-light');
        audio.voice(this.enemy.id as CharacterId, 'attack', 0.4);
        if (this.enemy.id === 'vael') {
          // ice-blade trail arc on every Vael swing
          this.vfx.vaelTrail(this.enemy.x + this.enemy.facing * 78, GROUND_Y - 210, this.enemy.facing);
        }
        if (enemyAttack.id === 'vael-special') {
          this.vfx.riftBurst(this.enemy.x + this.enemy.facing * 140, GROUND_Y - 180);
          audio.sfx('rift');
        }
      }
    }
  }

  private faceOpponents(): void {
    for (const [self, other] of [
      [this.kairo, this.enemy],
      [this.enemy, this.kairo],
    ] as const) {
      const state = self.stateMachine.current;
      if (state === FighterStateId.IDLE || state === FighterStateId.WALK || state === FighterStateId.BLOCK) {
        self.face(other.x >= self.x ? 1 : -1);
      }
    }
  }

  private separateFighters(): void {
    if (this.kairo.isDefeated || this.enemy.isDefeated) return;
    if (this.kairo.isAirborne) return;
    const dx = this.enemy.x - this.kairo.x;
    const overlap = FIGHTER_MIN_GAP - Math.abs(dx);
    if (overlap <= 0) return;
    const dir = dx >= 0 ? 1 : -1;
    const push = overlap / 2;
    this.kairo.sprite.x = clamp(this.kairo.sprite.x - dir * push, this.stageBounds.minX, this.stageBounds.maxX);
    this.enemy.sprite.x = clamp(this.enemy.sprite.x + dir * push, this.stageBounds.minX, this.stageBounds.maxX);
  }

  /** Playwright / debug hook. */
  private publishTestHook(): void {
    const w = window as Window & { __ccBattle?: Record<string, unknown> };
    const hook: Record<string, unknown> = {
      fightToken: this.fightToken,
      phase: this.phase,
      fightIndex: this.run.fightIndex,
      enemyId: this.run.enemyId,
      viewport: this.viewport,
      stageBounds: this.stageBounds,
      touchControlsVisible: this.touchControls.root.visible,
      kairoX: this.kairo.x,
      raiderX: this.enemy.x,
      kairoHealth: this.kairo.health,
      raiderHealth: this.enemy.health,
      kairoEnergy: this.kairo.energy,
      kairoAttackId: this.kairo.activeAttack?.id ?? null,
      kairoState: this.kairo.stateMachine.current,
      raiderState: this.enemy.stateMachine.current,
      vaelPhase: this.enemyAI instanceof VaelAI ? this.enemyAI.phase : 0,
      resultVisible: this.resultPanel != null,
      safe: this.safe,
    };
    if (import.meta.env.DEV) {
      // deterministic integration-test helpers (dev builds only).
      // Clamped to 1 HP: the decisive blow must land through the real combat
      // path so KO, defeat animation and result flow behave exactly as live.
      hook.damageEnemy = (n: number): void => {
        this.enemy.health = Math.max(1, this.enemy.health - n);
        this.hud.setEnemyHealth(this.enemy.health / this.enemy.config.maxHealth);
      };
      hook.damagePlayer = (n: number): void => {
        this.kairo.health = Math.max(1, this.kairo.health - n);
        this.hud.setPlayerHealth(this.kairo.health / this.run.maxHealth);
      };
    }
    w.__ccBattle = hook;
  }
}
