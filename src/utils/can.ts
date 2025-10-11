import type { Permission } from '../types';

/**
 * Check if a permission allows access
 * Returns a boolean
 *
 * @example
 * ```typescript
 * if (await can(canEdit, ctx, post)) {
 *   // User can edit
 * }
 * ```
 */

export async function can<TContext>(ctx: TContext, p: Permission<TContext>): Promise<boolean>;
export async function can<TContext, TResource>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resource: TResource
): Promise<boolean>;
export async function can<TContext, TResource = undefined>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resource?: TResource
): Promise<boolean> {
  const result = p.check(ctx, resource as TResource);
  return result instanceof Promise ? result : Promise.resolve(result);
}
