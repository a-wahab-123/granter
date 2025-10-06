/**
 * A function that checks if an action is allowed
 * Can be synchronous or asynchronous
 */
export type PermissionCheck<TContext, TResource = any> = (
  ctx: TContext,
  resource?: TResource
) => Promise<boolean> | boolean;

/**
 * A permission with a name and check function
 */
export type Permission<TContext, TResource = any> = {
  name: string;
  check: PermissionCheck<TContext, TResource>;
};

/**
 * Context-bound permission utilities returned by withContext()
 * Allows checking permissions without passing context repeatedly
 */
export type ContextBoundPermissions<TCtx> = {
  can: <T>(p: Permission<TCtx, T>, resource?: T) => Promise<boolean>;
  authorize: <T>(
    p: Permission<TCtx, T>, 
    resource?: T, 
    options?: { error?: string | Error | (() => Error) }
  ) => Promise<void>;
  filter: <T>(p: Permission<TCtx, T>, resources: T[]) => Promise<T[]>;
};