import type { ExplanationResult } from '../types';
import { ForbiddenError } from '../errors';
import { now } from './now';

/**
 * Create a new permission that can be called directly
 *
 * @example
 * ```typescript
 * const isAdmin = permission('isAdmin',
 *   (ctx) => ctx.user.role === 'admin'
 * );
 *
 * // Call directly
 * if (await isAdmin(ctx)) {
 *   // User is admin
 * }
 *
 * // Or use methods
 * await isAdmin.orThrow(ctx);
 * const why = await isAdmin.explain(ctx);
 * ```
 */

export type PermissionCheck<TContext, TResource = undefined> = (
  ctx: TContext,
  resource: TResource
) => Promise<boolean> | boolean;

// Base permission type
export type Permission<TContext, TResource = undefined> = {
  // Callable - resource optional when TResource = undefined
  (ctx: TContext, ...args: TResource extends undefined ? [] : [TResource]): Promise<boolean>;

  // Metadata
  name: string;
  children?: Permission<TContext, TResource>[];

  // Methods - resource optional when TResource = undefined
  orThrow(
    ctx: TContext,
    ...args: TResource extends undefined
      ? [error?: string | Error | (() => Error)]
      : [resource: TResource, error?: string | Error | (() => Error)]
  ): Promise<void>;

  filter(ctx: TContext, resources: TResource[]): Promise<TResource[]>;

  explain(
    ctx: TContext,
    ...args: TResource extends undefined ? [] : [TResource]
  ): Promise<ExplanationResult>;
};

export type PermissionResourceType<P> = P extends Permission<any, infer R> ? R : never;

export function permission<TContext>(
  name: string,
  check: PermissionCheck<TContext, undefined>,
  children?: Permission<TContext, undefined>[]
): Permission<TContext, undefined>;
export function permission<TContext, TResource>(
  name: string,
  check: PermissionCheck<TContext, TResource>,
  children?: Permission<TContext, TResource>[]
): Permission<TContext, TResource>;
export function permission<TContext, TResource = undefined>(
  name: string,
  check: PermissionCheck<TContext, TResource>,
  children?: Permission<TContext, TResource>[]
): Permission<TContext, TResource> {
  const fn = async (ctx: TContext, ...args: any[]): Promise<boolean> => {
    const resource = args[0] as TResource;
    return await check(ctx, resource);
  };

  Object.defineProperty(fn, 'name', {
    value: name,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  if (children && children.length > 0) {
    fn.children = children;
  }

  fn.orThrow = async (ctx: TContext, ...args: any[]): Promise<void> => {
    // For context-only: args = [error?]
    // For resource: args = [resource, error?]
    const hasResource =
      args.length >= 1 &&
      typeof args[0] !== 'string' &&
      typeof args[0] !== 'function' &&
      !(args[0] instanceof Error);
    const resource = hasResource ? args[0] : undefined;
    const error = hasResource ? args[1] : args[0];

    const allowed = await fn(ctx, ...(resource !== undefined ? [resource] : []));

    if (!allowed) {
      if (!error) {
        throw new ForbiddenError(`Permission denied: ${name}`);
      }

      if (typeof error === 'string') {
        throw new ForbiddenError(error);
      }

      if (typeof error === 'function') {
        throw error();
      }

      throw error;
    }
  };

  fn.filter = async (ctx: TContext, resources: TResource[]): Promise<TResource[]> => {
    const results = await Promise.all(resources.map((r) => fn(ctx, r as any)));
    return resources.filter((_, i) => results[i]);
  };

  fn.explain = async (ctx: TContext, ...args: any[]): Promise<ExplanationResult> => {
    const resource = args[0];
    const start = now();
    const value = await fn(ctx, ...(resource !== undefined ? [resource] : []));
    const duration = now() - start;

    const result: ExplanationResult = {
      name,
      value,
      duration,
    };

    if (fn.children && fn.children.length > 0) {
      result.children = await Promise.all(
        fn.children.map((p: any) => p.explain(ctx, ...(resource !== undefined ? [resource] : [])))
      );
    }

    return result;
  };

  return fn as Permission<TContext, TResource>;
}
