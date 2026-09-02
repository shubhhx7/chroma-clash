import { describe, expect, it } from 'vitest';
import { insetsToWorld } from '../../src/game/responsive/SafeAreaService';

describe('safe-area conversion', () => {
  it('converts CSS px insets into world units by zoom', () => {
    const world = insetsToWorld({ top: 10, right: 40, bottom: 20, left: 44 }, 2);
    expect(world).toEqual({ top: 5, right: 20, bottom: 10, left: 22 });
  });

  it('guards against zero/negative zoom', () => {
    const world = insetsToWorld({ top: 10, right: 10, bottom: 10, left: 10 }, 0);
    expect(world.top).toBe(10);
  });
});
