/** Registers cross-scene services and jumps straight into preloading. */
import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants';
import { SafeAreaService } from '../responsive/SafeAreaService';
import { detectDeviceProfile } from '../responsive/DeviceProfile';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create(): void {
    this.registry.set(REGISTRY.SAFE_AREA, new SafeAreaService());
    this.registry.set(REGISTRY.DEVICE_PROFILE, detectDeviceProfile());
    this.registry.set(REGISTRY.LOAD_ERRORS, [] as string[]);
    this.scene.start(SCENES.PRELOAD);
  }
}
