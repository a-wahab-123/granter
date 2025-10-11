import { describe, it, expect } from 'vitest';
import {
  permission,
  or,
  and,
  not,
  can,
  authorize,
  filter,
  withContext,
  withAbility,
  PermissionError,
  UnauthorizedError,
  ForbiddenError,
} from './index';

type Post = { authorId: string };
type Article = { authorId: string; title: string };
type User = { id: string; role: string };

type TestContext = {
  user: User;
};

const post = { authorId: '1' };
const article = { authorId: '1', title: 'Test' };
const user = { id: '1', role: 'user' };

describe('granter', () => {
  const isAdmin = permission<TestContext>('isAdmin', (ctx) => ctx.user.role === 'admin');

  const isUser = permission<TestContext>('isUser', (ctx) => ctx.user.role === 'user');

  const isOwner = permission<TestContext, { authorId: string }>(
    'isOwner',
    (ctx, resource) => resource.authorId === ctx.user.id
  );

  const isArticleOwner = permission<TestContext, Article>(
    'isArticleOwner',
    (ctx, resource) => resource.authorId === ctx.user.id
  );

  const isPostOwner = permission<TestContext, Post>(
    'isPostOwner',
    (ctx, resource) => resource.authorId === ctx.user.id
  );

  describe('permission', () => {
    it('should create a permission', () => {
      expect(isAdmin.name).toBe('isAdmin');
      expect(typeof isAdmin.check).toBe('function');
    });
  });

  describe('can', () => {
    it('should return true when permission allows', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await can(ctx, isAdmin)).toBe(true);
    });

    it('should return false when permission denies', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, isAdmin)).toBe(false);
    });

    it('should work with resources', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, isOwner, post)).toBe(true);
    });
  });

  describe('or', () => {
    it('should allow if any permission allows', async () => {
      const canAccess = or(isAdmin);
      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await can(ctx, canAccess)).toBe(true);
    });

    it('should allow if any permission allows', async () => {
      const canAccess = or(isOwner);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, canAccess, post)).toBe(true);
    });

    it('should allow if any permission allows', async () => {
      const canAccess = or(isAdmin, isUser);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, canAccess)).toBe(true);
    });

    it('should deny if all permissions deny', async () => {
      const isGuest = permission<TestContext>('isGuest', (ctx) => ctx.user.role === 'guest');
      const canAccess = or(isAdmin, isGuest);
      const ctx = { user: { id: '1', role: 'other' } };
      expect(await can(ctx, canAccess)).toBe(false);
    });

    it('should work with multiple permissions', async () => {
      const canAccess = or(isAdmin, isUser, isPostOwner, isArticleOwner);
      const ctx = { user };
      expect(await can(ctx, canAccess, post)).toBe(true);
    });

    it('should run all checks in parallel', async () => {
      const checkOrder: number[] = [];

      const perm1 = permission<TestContext>('perm1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        checkOrder.push(1);
        return false;
      });

      const perm2 = permission<TestContext>('perm2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        checkOrder.push(2);
        return false;
      });

      const perm3 = permission<TestContext>('perm3', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        checkOrder.push(3);
        return false;
      });

      const combined = or(perm1, perm2, perm3);
      const ctx = { user: { id: '1', role: 'user' } };

      const start = Date.now();
      await can(ctx, combined);
      const duration = Date.now() - start;

      // Should complete in ~30ms (parallel) not ~60ms (sequential)
      expect(duration).toBeLessThan(50);

      // Fastest check completes first
      expect(checkOrder[0]).toBe(2); // 10ms check
      expect(checkOrder[1]).toBe(3); // 20ms check
      expect(checkOrder[2]).toBe(1); // 30ms check
    });

    it('should batch well with async checks (simulating DataLoader)', async () => {
      let batchCount = 0;
      const batchedChecks: number[] = [];

      // Simulate a DataLoader-style batched check
      const createBatchedPermission = (id: number, allowed: boolean) => {
        return permission<TestContext>(`batched${id}`, async () => {
          batchedChecks.push(id);
          // If this is the first check in current tick, increment batch count
          if (batchedChecks.length === 1) {
            batchCount++;
          }
          return allowed;
        });
      };

      const perm1 = createBatchedPermission(1, false);
      const perm2 = createBatchedPermission(2, false);
      const perm3 = createBatchedPermission(3, true);

      const combined = or(perm1, perm2, perm3);
      const ctx = { user: { id: '1', role: 'user' } };

      const result = await can(ctx, combined);

      expect(result).toBe(true);
      // All three checks should run in parallel (same batch)
      expect(batchedChecks).toEqual([1, 2, 3]);
    });
  });

  describe('and', () => {
    it('should allow only if all permissions allow', async () => {
      const isAuthenticated = permission<TestContext>('isAuthenticated', (ctx) => !!ctx.user);
      const both = and(isAuthenticated, isUser);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, both)).toBe(true);
    });

    it('should deny if any permission denies', async () => {
      const both = and(isAdmin, isUser);
      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await can(ctx, both)).toBe(false);
    });
  });

  describe('not', () => {
    it('should invert permission result', async () => {
      const isNotAdmin = not(isAdmin);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, isNotAdmin)).toBe(true);
    });

    it('should work in compositions', async () => {
      const canComment = and(isUser, not(isAdmin));
      const adminCtx = { user: { id: '1', role: 'admin' } };
      const userCtx = { user: { id: '2', role: 'user' } };

      expect(await can(adminCtx, canComment)).toBe(false);
      expect(await can(userCtx, canComment)).toBe(true);
    });
  });

  describe('authorize', () => {
    it('should not throw when permission allows', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      await expect(authorize(ctx, isAdmin)).resolves.toBeUndefined();
    });

    it('should throw ForbiddenError when permission denies', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      await expect(authorize(ctx, isAdmin)).rejects.toThrow(ForbiddenError);
    });

    it('should include permission name in error', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      await expect(authorize(ctx, isAdmin)).rejects.toThrow('isAdmin');
    });
  });

  describe('filter', () => {
    it('should filter to only allowed items', async () => {
      const posts = [{ authorId: '1' }, { authorId: '2' }, { authorId: '1' }];

      const ctx = { user: { id: '1', role: 'user' } };
      const owned = await filter(ctx, isOwner, posts);

      expect(owned).toHaveLength(2);
      expect(owned.every((p) => p.authorId === '1')).toBe(true);
    });

    it('should return empty array if no items allowed', async () => {
      const posts = [{ authorId: '2' }, { authorId: '3' }];
      const ctx = { user: { id: '1', role: 'user' } };
      const owned = await filter(ctx, isOwner, posts);

      expect(owned).toHaveLength(0);
    });
  });

  describe('withContext', () => {
    // Changed from 'createChecker'
    it('should create bound permissions', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const bound = withContext(ctx); // Changed

      expect(await bound.can(isAdmin)).toBe(true);
    });

    it('should work with resources', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      const bound = withContext(ctx); // Changed
      const post = { authorId: '1' };

      expect(await bound.can(isOwner, post)).toBe(true);
    });

    it('should authorize correctly', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const bound = withContext(ctx); // Changed

      await expect(bound.authorize(isAdmin)).resolves.toBeUndefined();
    });

    it('should filter correctly', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      const bound = withContext(ctx); // Changed
      const posts = [{ authorId: '1' }, { authorId: '2' }];

      const owned = await bound.filter(isOwner, posts);
      expect(owned).toHaveLength(1);
    });
  });

  describe('withAbility', () => {
    it('should create enhanced context with permission methods', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const enhanced = withAbility(ctx);

      // Should have permission methods
      expect(typeof enhanced.can).toBe('function');
      expect(typeof enhanced.authorize).toBe('function');
      expect(typeof enhanced.filter).toBe('function');

      // Should have original context properties
      expect(enhanced.user).toBe(ctx.user);
    });

    it('should work with can method', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const enhanced = withAbility(ctx);

      expect(await enhanced.can(isAdmin)).toBe(true);
      expect(await enhanced.can(isUser)).toBe(false);
    });

    it('should work with resources', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      const enhanced = withAbility(ctx);
      const post = { authorId: '1' };

      expect(await enhanced.can(isOwner, post)).toBe(true);
    });

    it('should authorize correctly', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const enhanced = withAbility(ctx);

      await expect(enhanced.authorize(isAdmin)).resolves.toBeUndefined();
    });

    it('should throw on unauthorized', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      const enhanced = withAbility(ctx);

      await expect(enhanced.authorize(isAdmin)).rejects.toThrow(ForbiddenError);
    });

    it('should filter correctly', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      const enhanced = withAbility(ctx);
      const posts = [{ authorId: '1' }, { authorId: '2' }, { authorId: '1' }];

      const owned = await enhanced.filter(isOwner, posts);
      expect(owned).toHaveLength(2);
      expect(owned.every((p) => p.authorId === '1')).toBe(true);
    });

    it('should allow destructuring context properties and methods', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const enhanced = withAbility(ctx);

      // Destructure both original context and permission methods
      const { user, can: canCheck, authorize: auth } = enhanced;

      expect(user).toBe(ctx.user);
      expect(typeof canCheck).toBe('function');
      expect(typeof auth).toBe('function');

      expect(await canCheck(isAdmin)).toBe(true);
    });

    it('should preserve all context properties', () => {
      type ExtendedContext = {
        user: { id: string; role: string };
        db: { connection: string };
        loaders: { post: string };
        settings: { theme: string };
      };

      const ctx: ExtendedContext = {
        user: { id: '1', role: 'admin' },
        db: { connection: 'postgres' },
        loaders: { post: 'loader' },
        settings: { theme: 'dark' },
      };

      const enhanced = withAbility(ctx);

      // All original properties should be preserved
      expect(enhanced.user).toBe(ctx.user);
      expect(enhanced.db).toBe(ctx.db);
      expect(enhanced.loaders).toBe(ctx.loaders);
      expect(enhanced.settings).toBe(ctx.settings);

      // Plus permission methods
      expect(typeof enhanced.can).toBe('function');
      expect(typeof enhanced.authorize).toBe('function');
      expect(typeof enhanced.filter).toBe('function');
    });

    it('should work in middleware pattern', async () => {
      // Simulating Express/Hono middleware pattern
      const ctx = { user: { id: '1', role: 'admin' } };
      const enhanced = withAbility(ctx);

      // Destructure in route handler
      const { user, authorize } = enhanced;

      expect(user.id).toBe('1');
      await expect(authorize(isAdmin)).resolves.toBeUndefined();
    });
  });

  describe('errors', () => {
    it('should create PermissionError', () => {
      const error = new PermissionError('test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PermissionError);
      expect(error.name).toBe('PermissionError');
      expect(error.message).toBe('test');
    });

    it('should create UnauthorizedError', () => {
      const error = new UnauthorizedError();
      expect(error).toBeInstanceOf(PermissionError);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.name).toBe('UnauthorizedError');
      expect(error.message).toBe('Authentication required');
    });

    it('should create ForbiddenError', () => {
      const error = new ForbiddenError();
      expect(error).toBeInstanceOf(PermissionError);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.name).toBe('ForbiddenError');
      expect(error.message).toBe('Access forbidden');
    });

    it('should allow custom error messages', () => {
      const error1 = new UnauthorizedError('Custom auth message');
      const error2 = new ForbiddenError('Custom forbidden message');

      expect(error1.message).toBe('Custom auth message');
      expect(error2.message).toBe('Custom forbidden message');
    });
  });

  describe('async permissions', () => {
    it('should handle async permission checks', async () => {
      const asyncPerm = permission<TestContext>('asyncPerm', async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ctx.user.role === 'admin';
      });

      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await can(ctx, asyncPerm)).toBe(true);
    });

    it('should work in compositions with async permissions', async () => {
      const asyncPerm = permission<TestContext>('asyncPerm', async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ctx.user.role === 'admin';
      });

      const combined = or(asyncPerm, isUser);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, combined)).toBe(true);
    });
  });

  describe('mixing resource-less and resource-specific permissions', () => {
    const isAuthenticated = permission<TestContext>('isAuthenticated', (ctx) => !!ctx.user);

    const isModerator = permission<TestContext>(
      'isModerator',
      (ctx) => ctx.user.role === 'moderator'
    );

    const isPostOwner = permission<TestContext, { authorId: string }>(
      'isPostOwner',
      (ctx, post) => post.authorId === ctx.user.id
    );

    it('should allow mixing resource-less with resource-specific in and()', async () => {
      // Put resource-specific first for proper type inference
      const canEdit = and(isPostOwner, isAuthenticated);
      const ctx = { user: { id: '1', role: 'user' } };
      const post = { authorId: '1' };

      expect(await can(ctx, canEdit, post)).toBe(true);
    });

    it('should work when resource-less comes after', async () => {
      const canEdit = and(isPostOwner, isAuthenticated, isModerator);
      const ctx = { user: { id: '1', role: 'moderator' } };
      const post = { authorId: '1' };

      expect(await can(ctx, canEdit, post)).toBe(true);
    });

    it('should allow mixing in or()', async () => {
      // Redeclare isAdmin to work with resource type
      const isAdminAny = permission<TestContext>('isAdmin', (ctx) => ctx.user.role === 'admin');

      const canDelete = or(isPostOwner, isAdminAny);
      const ctx = { user: { id: '1', role: 'user' } };
      const post = { authorId: '1' };

      expect(await can(ctx, canDelete, post)).toBe(true);
    });

    it('should work with multiple resource-less permissions', async () => {
      const hasAccess = and(isAuthenticated, isModerator);
      const ctx = { user: { id: '1', role: 'moderator' } };

      expect(await can(ctx, hasAccess)).toBe(true);
    });

    it('should fail when resource-specific permission fails', async () => {
      const canEdit = and(isPostOwner, isAuthenticated);
      const ctx = { user: { id: '1', role: 'user' } };
      const post = { authorId: '2' };

      expect(await can(ctx, canEdit, post)).toBe(false);
    });
  });

  describe('operator nesting', () => {
    const isBanned = permission<TestContext>(
      'isBanned',
      (ctx) => (ctx.user as any).banned === true
    );

    const isAuthenticated = permission<TestContext>('isAuthenticated', (ctx) => !!ctx.user);

    describe('not(and(...))', () => {
      it('should negate an and composition', async () => {
        const isBannedAndUser = and(isBanned, isUser);
        const isNotBannedAndUser = not(isBannedAndUser);

        const ctx = { user: { id: '1', role: 'user', banned: true } as any };

        expect(await can(ctx, isBannedAndUser)).toBe(true);
        expect(await can(ctx, isNotBannedAndUser)).toBe(false);
      });

      it("should implement De Morgan's law: not(A and B) === not(A) or not(B)", async () => {
        const notBoth = not(and(isAdmin, isBanned));
        const neitherOr = or(not(isAdmin), not(isBanned));

        // Test case 1: admin and banned
        const ctx1 = { user: { id: '1', role: 'admin', banned: true } as any };
        expect(await can(ctx1, notBoth)).toBe(false);
        expect(await can(ctx1, neitherOr)).toBe(false);

        // Test case 2: admin and not banned
        const ctx2 = { user: { id: '2', role: 'admin', banned: false } as any };
        expect(await can(ctx2, notBoth)).toBe(true);
        expect(await can(ctx2, neitherOr)).toBe(true);

        // Test case 3: not admin and banned
        const ctx3 = { user: { id: '3', role: 'user', banned: true } as any };
        expect(await can(ctx3, notBoth)).toBe(true);
        expect(await can(ctx3, neitherOr)).toBe(true);
      });
    });

    describe('not(or(...))', () => {
      it('should negate an or composition', async () => {
        const isAdminOrBanned = or(isAdmin, isBanned);
        const isNeitherAdminNorBanned = not(isAdminOrBanned);

        const ctx1 = { user: { id: '1', role: 'user', banned: false } as any };
        expect(await can(ctx1, isNeitherAdminNorBanned)).toBe(true);

        const ctx2 = { user: { id: '2', role: 'admin', banned: false } as any };
        expect(await can(ctx2, isNeitherAdminNorBanned)).toBe(false);
      });
    });

    describe('complex nesting', () => {
      it('should handle deeply nested operators', async () => {
        // Can comment if: authenticated AND (admin OR (user AND NOT banned))
        const canComment = and(isAuthenticated, or(isAdmin, and(isUser, not(isBanned))));

        // Admin can comment
        const ctx1 = { user: { id: '1', role: 'admin', banned: false } as any };
        expect(await can(ctx1, canComment)).toBe(true);

        // User (not banned) can comment
        const ctx2 = { user: { id: '2', role: 'user', banned: false } as any };
        expect(await can(ctx2, canComment)).toBe(true);

        // Banned user cannot comment
        const ctx3 = { user: { id: '3', role: 'user', banned: true } as any };
        expect(await can(ctx3, canComment)).toBe(false);
      });

      it('should handle not() wrapping complex compositions', async () => {
        const cannotModerate = not(and(isAuthenticated, or(isAdmin, isUser)));

        const ctx = { user: { id: '1', role: 'admin' } };
        expect(await can(ctx, cannotModerate)).toBe(false);
      });

      it('should work with triple nesting', async () => {
        const permission1 = or(and(isAdmin, not(isBanned)), and(isUser, not(isBanned)));

        const ctx1 = { user: { id: '1', role: 'admin', banned: false } as any };
        expect(await can(ctx1, permission1)).toBe(true);

        const ctx2 = { user: { id: '2', role: 'user', banned: true } as any };
        expect(await can(ctx2, permission1)).toBe(false);
      });
    });

    describe('double negation', () => {
      it('should return to original with not(not(...))', async () => {
        const notAdmin = not(isAdmin);
        const notNotAdmin = not(notAdmin);

        const ctx = { user: { id: '1', role: 'admin' } };

        expect(await can(ctx, isAdmin)).toBe(true);
        expect(await can(ctx, notAdmin)).toBe(false);
        expect(await can(ctx, notNotAdmin)).toBe(true);
      });
    });
  });

  describe('type inheritance', () => {
    type Post = { id: string; authorId: string; title: string };
    type HistoricalPost = Post & { archivedAt: Date; archivedBy: string };

    const isPostOwner = permission<TestContext, Post>(
      'isPostOwner',
      (ctx, post) => post?.authorId === ctx.user.id
    );

    const isHistoricalArchiver = permission<TestContext, HistoricalPost>(
      'isHistoricalArchiver',
      (ctx, post) => post?.archivedBy === ctx.user.id
    );

    it('should work when mixing base and extended types', async () => {
      const canView = or(isPostOwner, isHistoricalArchiver);
      const ctx = { user: { id: 'user1', role: 'user' } };

      // HistoricalPost (has all properties)
      const historicalPost: HistoricalPost = {
        id: '1',
        authorId: 'user2',
        title: 'Test',
        archivedAt: new Date(),
        archivedBy: 'user1',
      };

      expect(await can(ctx, canView, historicalPost)).toBe(true);
    });

    it('should handle missing properties gracefully with optional chaining', async () => {
      const canView = or(isPostOwner, isHistoricalArchiver);
      const ctx = { user: { id: 'user1', role: 'user' } };

      // Regular Post (missing HistoricalPost properties)
      const regularPost: Post = {
        id: '1',
        authorId: 'user1',
        title: 'Test',
      };

      // Should work because isPostOwner succeeds
      expect(await can(ctx, canView, regularPost as any)).toBe(true);
    });

    it('should work in and() with inherited types', async () => {
      const canEdit = and(isPostOwner, isHistoricalArchiver);
      const ctx = { user: { id: 'user1', role: 'user' } };

      const historicalPost: HistoricalPost = {
        id: '1',
        authorId: 'user1',
        title: 'Test',
        archivedAt: new Date(),
        archivedBy: 'user1',
      };

      expect(await can(ctx, canEdit, historicalPost)).toBe(true);
    });
  });

  describe('complex real-world scenarios', () => {
    type Post = { id: string; authorId: string; published: boolean; locked?: boolean };

    const isAuthenticated = permission<TestContext>('isAuthenticated', (ctx) => !!ctx.user);

    const isAdminPost = permission<TestContext>('isAdmin', (ctx) => ctx.user.role === 'admin');

    const isPostOwner = permission<TestContext, Post>(
      'isPostOwner',
      (ctx, post) => post?.authorId === ctx.user.id
    );

    const isPublished = permission<TestContext, Post>(
      'isPublished',
      (_ctx, post) => post?.published === true
    );

    const isNotLocked = permission<TestContext, Post>(
      'isNotLocked',
      (_ctx, post) => post?.locked !== true
    );

    it('should handle complex permission: can edit if (authenticated AND owner AND NOT locked) OR admin', async () => {
      const canEdit = or(and(isPostOwner, isAuthenticated, isNotLocked), isAdminPost);

      // Owner can edit unlocked post
      const ctx1 = { user: { id: '1', role: 'user' } };
      const post1: Post = { id: '1', authorId: '1', published: true, locked: false };
      expect(await can(ctx1, canEdit, post1)).toBe(true);

      // Owner cannot edit locked post
      const post2: Post = { id: '2', authorId: '1', published: true, locked: true };
      expect(await can(ctx1, canEdit, post2)).toBe(false);

      // Admin can edit locked post
      const ctx2 = { user: { id: '2', role: 'admin' } };
      expect(await can(ctx2, canEdit, post2)).toBe(true);
    });

    it('should handle: can view if published OR (authenticated AND owner)', async () => {
      const canView = or(isPublished, and(isPostOwner, isAuthenticated));

      // Anyone can view published post
      const ctx1 = { user: { id: '1', role: 'user' } };
      const post1: Post = { id: '1', authorId: '2', published: true };
      expect(await can(ctx1, canView, post1)).toBe(true);

      // Owner can view unpublished post
      const post2: Post = { id: '2', authorId: '1', published: false };
      expect(await can(ctx1, canView, post2)).toBe(true);

      // Non-owner cannot view unpublished post
      const post3: Post = { id: '3', authorId: '2', published: false };
      expect(await can(ctx1, canView, post3)).toBe(false);
    });

    it('should work with filter for complex permissions', async () => {
      const canEdit = or(isPostOwner, isAdminPost);

      const ctx = { user: { id: '1', role: 'user' } };
      const posts: Post[] = [
        { id: '1', authorId: '1', published: true },
        { id: '2', authorId: '2', published: true },
        { id: '3', authorId: '1', published: false },
        { id: '4', authorId: '3', published: true },
      ];

      const editable = await filter(ctx, canEdit, posts);
      expect(editable).toHaveLength(2);
      expect(editable.map((p) => p.id)).toEqual(['1', '3']);
    });

    it('should work with authorize for complex permissions', async () => {
      const canPublish = and(isPostOwner, isAuthenticated, not(isPublished));

      const ctx = { user: { id: '1', role: 'user' } };

      // Can publish unpublished owned post
      const post1: Post = { id: '1', authorId: '1', published: false };
      await expect(authorize(ctx, canPublish, post1)).resolves.toBeUndefined();

      // Cannot publish already published post
      const post2: Post = { id: '2', authorId: '1', published: true };
      await expect(authorize(ctx, canPublish, post2)).rejects.toThrow(ForbiddenError);

      // Cannot publish someone else's post
      const post3: Post = { id: '3', authorId: '2', published: false };
      await expect(authorize(ctx, canPublish, post3)).rejects.toThrow(ForbiddenError);
    });
  });
});
