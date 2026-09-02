/**
 * Arena state hooks (Phase 2+): lighting states from
 * 08_arena_lighting_state_sheet.png and animated props from
 * 06_arena_animated_prop_sheet.png will be driven from here (fight phase,
 * boss aura, KO flash). Phase 1 keeps the neutral state.
 */
export type ArenaLightingState = 'neutral' | 'danger' | 'victory';

export class ArenaStateController {
  private state: ArenaLightingState = 'neutral';

  setState(state: ArenaLightingState): void {
    this.state = state;
  }

  get current(): ArenaLightingState {
    return this.state;
  }
}
