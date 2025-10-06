import { type Permission, type ContextBoundPermissions } from "../types";
import { can } from "./can";
import { authorize } from "./authorize";
import { filter } from "./filter";

export function withContext<TCtx>(ctx: TCtx): ContextBoundPermissions<TCtx> {
  return {
    can: <T>(p: Permission<TCtx, T>, resource?: T) => 
      can(ctx, p, resource),
    
    authorize: <T>(
      p: Permission<TCtx, T>, 
      resource?: T, 
      options?: { error?: string | Error | (() => Error) }
    ) => 
      authorize(ctx, p, resource, options),
    
    filter: <T>(p: Permission<TCtx, T>, resources: T[]) => 
      filter(ctx, p, resources),
  };
}
