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

export type Permission<TContext, TResource = undefined> = {
  (ctx: TContext, resource: TResource): Promise<boolean>;

  // Metadata
  name: string;
  permissions: Permission<TContext, TResource>[];

  // Methods
  orThrow(ctx: TContext, resource: TResource, error?:string | Error | (() => Error)): Promise<void>;
  filter(ctx: TContext, resources: TResource[]): Promise<TResource[]>;
  explain(ctx: TContext, resource: TResource): Promise<ExplanationResult>;
};

export type PermissionResourceType<P> = P extends Permission<any, infer R> ? R : never;

export function permission<TContext>(
  name: string,
  check: PermissionCheck<TContext, undefined>,
  permissions?: Permission<TContext, undefined>[]
): Permission<TContext, undefined>;
export function permission<TContext, TResource>(
  name: string,
  check: PermissionCheck<TContext, TResource>,
  permissions?: Permission<TContext, TResource>[]
): Permission<TContext, TResource>;
export function permission<TContext, TResource = undefined>(
  name: string,
  check: PermissionCheck<TContext, TResource>,
  permissions: Permission<TContext, TResource>[] = []
): Permission<TContext, TResource> {

  const fn = async (ctx: TContext, resource: TResource): Promise<boolean> => {
    return await check(ctx, resource);
  };

  Object.defineProperty(fn, 'name', {
    value: name,
    writable: false,
    enumerable: false,
    configurable: true
  });

  fn.permissions = permissions;

  fn.orThrow = async (ctx: TContext, resource: TResource, error?:string | Error | (() => Error)): Promise<void> => {
    if (!(await fn(ctx, resource))) {
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
    const results = await Promise.all(resources.map((r) => fn(ctx, r)));
    return resources.filter((_, i) => results[i]);
  };
  
  fn.explain = async (ctx: TContext, resource: TResource): Promise<ExplanationResult> => {
    const start = now();
    const value = await fn(ctx, resource);
    const duration = now() - start;

    const result: ExplanationResult = {
      name,
      value,
      duration
    };

    if (permissions) {
      result.children = await Promise.all(permissions.map((p) => p.explain(ctx, resource)));
    }

    return result;
  };
  
  return fn as Permission<TContext, TResource>;
}
