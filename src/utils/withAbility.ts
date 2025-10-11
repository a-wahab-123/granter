import { withContext } from './withContext';

export function withAbility<TContext>(ctx: TContext) {
  return {
    ...ctx,
    ...withContext(ctx),
  };
}
