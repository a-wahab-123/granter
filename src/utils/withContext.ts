/**
 * Binds context to permissions so you don't need to pass ctx repeatedly
 */
export function withContext<TContext, T extends Record<string, any>>(
  ctx: TContext,
  permissions: T
): {
  [K in keyof T]: T[K] extends (ctx: TContext, ...args: infer Args) => infer R
    ? (...args: Args) => R
    : T[K];
} {
  const bound = {} as any;

  for (const [key, permission] of Object.entries(permissions)) {
    if (typeof permission === 'function') {
      bound[key] = (...args: any[]) => permission(ctx, ...args);
    } else {
      bound[key] = permission;
    }
  }

  return bound;
}
