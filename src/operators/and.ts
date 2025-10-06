import type { Permission } from '../types';
import { permission } from '../utils/permission';

/**
 * Combine permissions with AND logic
 * Returns true only if ALL permissions allow access
 * 
 * @example
 * ```typescript
 * const canPublish = and(isAuthenticated, isOwner, hasVerifiedEmail);
 * ```
 */
export function and<TContext, T1>(
  p1: Permission<TContext, T1>,
): Permission<TContext, T1>;
export function and<TContext, T1, T2>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>
): Permission<TContext, T1 & T2>;
export function and<TContext, T1, T2, T3>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>,
  p3: Permission<TContext, T3>
): Permission<TContext, T1 & T2 & T3>;
export function and<TContext, T1, T2, T3, T4>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>,
  p3: Permission<TContext, T3>,
  p4: Permission<TContext, T4>
): Permission<TContext, T1 & T2 & T3 & T4>;
export function and<TContext, T1, T2, T3, T4, T5>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>,
  p3: Permission<TContext, T3>,
  p4: Permission<TContext, T4>,
  p5: Permission<TContext, T5>
): Permission<TContext, T1 & T2 & T3 & T4 & T5>;
export function and<TContext>(...permissions: Permission<TContext, any>[]): Permission<TContext, any> {
  return permission(
    `(${permissions.map(p => p.name).join(' AND ')})`,
    async (ctx, resource) => {
      for (const p of permissions) {
        const result = p.check(ctx, resource);
        const allowed = result instanceof Promise ? await result : result;
        if (!allowed) return false;
      }
      return true;
    }
  );
}