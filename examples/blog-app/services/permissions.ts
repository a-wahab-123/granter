/**
 * Application Permissions - Single source of truth
 *
 * All permissions are defined here in one place for easy discovery.
 * Organized by sections for readability.
 */

import { permission, or, and, not } from 'granter';
import type { AppContext, Post, Comment } from '../types';

// =============================================================================
// USER & AUTHENTICATION
// =============================================================================

export const isAuthenticated = permission<AppContext>(
  'isAuthenticated',
  (ctx) => ctx.user !== null
);

export const isGuest = permission<AppContext>('isGuest', (ctx) => ctx.user === null);

export const isVerified = permission<AppContext>(
  'isVerified',
  (ctx) => ctx.user?.isVerified ?? false
);

export const isNotBanned = permission<AppContext>('isNotBanned', (ctx) => !ctx.user?.isBanned);

export const isAdmin = permission<AppContext>('isAdmin', (ctx) => ctx.user?.role === 'admin');

export const isModerator = permission<AppContext>(
  'isModerator',
  (ctx) => ctx.user?.role === 'moderator'
);

export const isAdminOrModerator = permission<AppContext>(
  'isAdminOrModerator',
  (ctx) => ctx.user?.role === 'admin' || ctx.user?.role === 'moderator'
);

// =============================================================================
// POSTS
// =============================================================================

export const isPostOwner = permission<AppContext, Post>(
  'isPostOwner',
  (ctx, post) => ctx.user?.id === post.authorId
);

export const isPostPublished = permission<AppContext, Post>(
  'isPostPublished',
  (ctx, post) => post.published
);

export const isPostLocked = permission<AppContext, Post>(
  'isPostLocked',
  (ctx, post) => post.locked
);

// Composed post permissions
export const canViewPost = or(isPostPublished, isPostOwner, isAdmin, isModerator);

export const canCreatePost = and(isAuthenticated, isVerified, isNotBanned);

export const canEditPost = and(isAuthenticated, not(isPostLocked), or(isPostOwner, isAdmin));

export const canDeletePost = and(isAuthenticated, or(isPostOwner, isAdmin));

export const canPublishPost = and(
  isAuthenticated,
  isVerified,
  or(isPostOwner, isAdmin, isModerator)
);

export const canLockPost = or(isAdmin, isModerator);

// =============================================================================
// COMMENTS
// =============================================================================

export const isCommentOwner = permission<AppContext, Comment>(
  'isCommentOwner',
  (ctx, comment) => ctx.user?.id === comment.authorId
);

export const canCreateComment = permission<AppContext, Post>('canCreateComment', (ctx, post) => {
  if (!ctx.user || ctx.user.isBanned) return false;
  if (post.locked) return false;
  return true;
});

export const canEditComment = and(isAuthenticated, or(isCommentOwner, isAdmin));

export const canDeleteComment = and(isAuthenticated, or(isCommentOwner, isAdmin, isModerator));

// =============================================================================
// HELPER: BIND CONTEXT
// =============================================================================

type Permission<TContext, TResource = undefined> = TResource extends undefined
  ? (ctx: TContext) => Promise<boolean>
  : (ctx: TContext, resource: TResource) => Promise<boolean>;

type BoundPermissions<TContext, T> = {
  [K in keyof T]: T[K] extends Permission<TContext, infer TResource>
    ? TResource extends undefined
      ? () => Promise<boolean>
      : (resource: TResource) => Promise<boolean>
    : never;
};

/**
 * Bind context to permissions - no more passing ctx every time!
 *
 * Instead of manually creating a factory like definePermissionsFor,
 * just pick the permissions you need and bind them to your context.
 *
 * @example
 * ```typescript
 * // Import only what you need
 * import { bindContext, isAuthenticated, canEditPost } from './permissions';
 *
 * // Bind context once
 * const abilities = bindContext(ctx, {
 *   isAuthenticated,
 *   canEditPost,
 * });
 *
 * // Use without ctx!
 * if (await abilities.isAuthenticated()) { ... }
 * if (await abilities.canEditPost(post)) { ... }
 * ```
 */
export function bindContext<TContext, T extends Record<string, Permission<TContext, any>>>(
  ctx: TContext,
  permissions: T
): BoundPermissions<TContext, T> {
  const bound: any = {};

  for (const key in permissions) {
    const permission = permissions[key];
    bound[key] = (...args: any[]) => permission(ctx, ...args);
  }

  return bound;
}

// =============================================================================
// CASL-STYLE FACTORY (Alternative - less flexible but batteries-included)
// =============================================================================

/**
 * Pre-configured abilities factory (like CASL's defineAbilityFor)
 *
 * Use this if you want all permissions available.
 * Use bindContext() if you want to pick specific permissions.
 *
 * @example
 * ```typescript
 * const abilities = definePermissionsFor(ctx);
 * if (await abilities.canEditPost(post)) { ... }
 * ```
 */
export function definePermissionsFor(ctx: AppContext) {
  return bindContext(ctx, {
    // User checks (no resource needed)
    isAuthenticated,
    isAdmin,
    isModerator,
    isVerified,

    // Post permissions
    canViewPost,
    canCreatePost,
    canEditPost,
    canDeletePost,
    canPublishPost,
    canLockPost,

    // Comment permissions
    canCreateComment,
    canEditComment,
    canDeleteComment,
  });
}
