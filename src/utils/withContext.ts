import { type Permission } from '../types';
import { can } from './can';
import { authorize, type AuthorizeOptions } from './authorize';
import { filter } from './filter';

/**
 * Context-bound permission utilities returned by withContext()
 * Allows checking permissions without passing context repeatedly
 */
export type ContextBoundPermissions<TContext> = {
  can(p: Permission<TContext>): Promise<boolean>;
  can<TResource>(p: Permission<TContext, TResource>, resource: TResource): Promise<boolean>;

  authorize(
    p: Permission<TContext>,
    resource?: undefined,
    options?: AuthorizeOptions
  ): Promise<void>;
  authorize<TResource>(
    p: Permission<TContext, TResource>,
    resource: TResource,
    options?: AuthorizeOptions
  ): Promise<void>;

  filter: <TResource>(
    p: Permission<TContext, TResource>,
    resources: TResource[]
  ) => Promise<TResource[]>;
};

export function withContext<TContext>(ctx: TContext): ContextBoundPermissions<TContext> {
  return {
    can: <TResource = undefined>(p: Permission<TContext, TResource>, resource?: TResource) =>
      can(ctx, p, resource as TResource),

    authorize: <TResource = undefined>(
      p: Permission<TContext, TResource>,
      resource?: TResource,
      options?: AuthorizeOptions
    ) => authorize(ctx, p, resource as TResource, options),

    filter: <T>(p: Permission<TContext, T>, resources: T[]) => filter(ctx, p, resources),
  };
}
