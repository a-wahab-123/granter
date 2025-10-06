import { Permission } from "../types";
import { can } from "./can";

/**
 * Filter an array to only items the user has permission for
 * 
 * @example
 * ```typescript
 * const allPosts = await getPosts();
 * const editablePosts = await filter(canEdit, ctx, allPosts);
 * ```
 */
export async function filter<TContext, TResource>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resources: TResource[]
): Promise<TResource[]> {
  const results = await Promise.all(
    resources.map(r => can(ctx,p, r))
  );
  return resources.filter((_, i) => results[i]);
}
  