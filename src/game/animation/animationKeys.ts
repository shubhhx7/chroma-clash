/**
 * Phaser animation key naming. One animation per processed strip; the anim
 * key equals the texture key so lookups stay trivial and collision-free.
 */
export function animKeyFor(textureKey: string): string {
  return `anim:${textureKey}`;
}
