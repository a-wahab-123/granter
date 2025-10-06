import { type Permission } from "../types";
import { can } from "./can";
import { authorize } from "./authorize";
import { filter } from "./filter";

export function withAbility<TContext>(ctx: TContext) {
  return {
    ...ctx,
    can: <TResource>(p: Permission<TContext, TResource>, resource?: TResource) => 
      can(ctx, p, resource),
    authorize: <TResource>(p: Permission<TContext, TResource>, resource?: TResource, options?: any) => 
      authorize(ctx, p, resource, options),
    filter: <TResource>(p: Permission<TContext, TResource>, resources: TResource[]) => 
      filter(ctx, p, resources),
  } as const;
}