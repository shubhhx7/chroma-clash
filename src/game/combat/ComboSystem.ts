/** Combo counting: consecutive player hits without taking a hit or timing out. */

export const COMBO_TIMEOUT_MS = 2500;

export class ComboSystem {
  private count = 0;
  private sinceLastHitMs = 0;

  registerPlayerHit(): number {
    this.count++;
    this.sinceLastHitMs = 0;
    return this.count;
  }

  registerPlayerHurt(): void {
    this.count = 0;
  }

  update(dtMs: number): void {
    if (this.count === 0) return;
    this.sinceLastHitMs += dtMs;
    if (this.sinceLastHitMs >= COMBO_TIMEOUT_MS) this.count = 0;
  }

  get current(): number {
    return this.count;
  }
}
