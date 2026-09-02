import { FighterStateId, isTransitionAllowed, type FighterStateHandler } from './FighterState';

/**
 * Minimal explicit state machine. Transitions must pass BOTH the global
 * transition guard and the current state's own allowlist.
 */
export class FighterStateMachine<TContext> {
  private states = new Map<FighterStateId, FighterStateHandler<TContext>>();
  private currentId: FighterStateId | null = null;

  constructor(private readonly ctx: TContext) {}

  register(state: FighterStateHandler<TContext>): this {
    this.states.set(state.id, state);
    return this;
  }

  start(id: FighterStateId): void {
    const state = this.states.get(id);
    if (!state) throw new Error(`Unknown state ${id}`);
    this.currentId = id;
    state.enter(this.ctx);
  }

  get current(): FighterStateId {
    if (!this.currentId) throw new Error('State machine not started');
    return this.currentId;
  }

  /** Attempt a transition; returns false when refused by the guards. */
  transition(to: FighterStateId, force = false): boolean {
    if (!this.currentId) throw new Error('State machine not started');
    const from = this.states.get(this.currentId);
    const next = this.states.get(to);
    if (!from || !next) return false;
    if (!force) {
      if (!isTransitionAllowed(this.currentId, to)) return false;
      if (!from.canTransitionTo(to)) return false;
    }
    from.exit(this.ctx);
    this.currentId = to;
    next.enter(this.ctx);
    return true;
  }

  update(dtMs: number): void {
    if (!this.currentId) return;
    this.states.get(this.currentId)?.update(this.ctx, dtMs);
  }
}
