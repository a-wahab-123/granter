import { describe, it, expect } from 'vitest';
import {
  permission,
  or,
  and,
  not,
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
    it('should create a callable permission with methods', () => {
      expect(typeof isAdmin).toBe('function');
      expect(typeof isAdmin.orThrow).toBe('function');
      expect(typeof isAdmin.filter).toBe('function');
      expect(typeof isAdmin.explain).toBe('function');
    });
  });

  describe('direct permission calls', () => {
    it('should return true when permission allows', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await isAdmin(ctx)).toBe(true);
    });

    it('should return false when permission denies', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await isAdmin(ctx)).toBe(false);
    });

    it('should work with resources', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await isOwner(ctx, post)).toBe(true);
    });
  });

  describe('or', () => {
    it('should allow if any permission allows', async () => {
      const canAccess = or(isAdmin);
      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await canAccess(ctx, post)).toBe(true);
    });

    it('should allow if any permission allows', async () => {
      const canAccess = or(isOwner);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await canAccess(ctx, post)).toBe(true);
    });

    it('should allow if any permission allows', async () => {
      const canAccess = or(isAdmin, isUser);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await canAccess(ctx)).toBe(true);
    });

    it('should deny if all permissions deny', async () => {
      const isGuest = permission<TestContext>('isGuest', (ctx) => ctx.user.role === 'guest');
      const canAccess = or(isAdmin, isGuest);
      const ctx = { user: { id: '1', role: 'other' } };
      expect(await canAccess(ctx)).toBe(false);
    });

    it('should work with multiple permissions', async () => {
      const canAccess = or(isAdmin, isUser, isPostOwner, isArticleOwner);
      const ctx = { user };
      expect(await canAccess(ctx, post)).toBe(true);
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
      await combined(ctx);
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

      const result = await combined(ctx);

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
      expect(await both(ctx)).toBe(true);
    });

    it('should deny if any permission denies', async () => {
      const both = and(isAdmin, isUser);
      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await both(ctx)).toBe(false);
    });
  });

  describe('not', () => {
    it('should invert permission result', async () => {
      const isNotAdmin = not(isAdmin);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await isNotAdmin(ctx)).toBe(true);
    });

    it('should work in compositions', async () => {
      const canComment = and(isUser, not(isAdmin));
      const adminCtx = { user: { id: '1', role: 'admin' } };
      const userCtx = { user: { id: '2', role: 'user' } };

      expect(await canComment(adminCtx)).toBe(false);
      expect(await canComment(userCtx)).toBe(true);
    });
  });

  describe('orThrow', () => {
    it('should not throw when permission allows', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      await expect(isAdmin.orThrow(ctx)).resolves.toBeUndefined();
    });

    it('should throw ForbiddenError when permission denies', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      await expect(isAdmin.orThrow(ctx)).rejects.toThrow(ForbiddenError);
    });

    it('should include permission name in error', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      await expect(isAdmin.orThrow(ctx)).rejects.toThrow('isAdmin');
    });
  });

  describe('filter', () => {
    it('should filter to only allowed items', async () => {
      const posts = [{ authorId: '1' }, { authorId: '2' }, { authorId: '1' }];

      const ctx = { user: { id: '1', role: 'user' } };
      const owned = await isOwner.filter(ctx, posts);

      expect(owned).toHaveLength(2);
      expect(owned.every((p) => p.authorId === '1')).toBe(true);
    });

    it('should return empty array if no items allowed', async () => {
      const posts = [{ authorId: '2' }, { authorId: '3' }];
      const ctx = { user: { id: '1', role: 'user' } };
      const owned = await isOwner.filter(ctx, posts);

      expect(owned).toHaveLength(0);
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
      expect(await asyncPerm(ctx)).toBe(true);
    });

    it('should work in compositions with async permissions', async () => {
      const asyncPerm = permission<TestContext>('asyncPerm', async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ctx.user.role === 'admin';
      });

      const combined = or(asyncPerm, isUser);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await combined(ctx)).toBe(true);
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

      expect(await canEdit(ctx, post)).toBe(true);
    });

    it('should work when resource-less comes after', async () => {
      const canEdit = and(isPostOwner, isAuthenticated, isModerator);
      const ctx = { user: { id: '1', role: 'moderator' } };
      const post = { authorId: '1' };

      expect(await canEdit(ctx, post)).toBe(true);
    });

    it('should allow mixing in or()', async () => {
      // Redeclare isAdmin to work with resource type
      const isAdminAny = permission<TestContext>('isAdmin', (ctx) => ctx.user.role === 'admin');

      const canDelete = or(isPostOwner, isAdminAny);
      const ctx = { user: { id: '1', role: 'user' } };
      const post = { authorId: '1' };

      expect(await canDelete(ctx, post)).toBe(true);
    });

    it('should work with multiple resource-less permissions', async () => {
      const hasAccess = and(isAuthenticated, isModerator);
      const ctx = { user: { id: '1', role: 'moderator' } };

        expect(await hasAccess(ctx)).toBe(true);
    });

    it('should fail when resource-specific permission fails', async () => {
      const canEdit = and(isPostOwner, isAuthenticated);
      const ctx = { user: { id: '1', role: 'user' } };
      const post = { authorId: '2' };

      expect(await canEdit(ctx, post)).toBe(false);
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

        expect(await isBannedAndUser(ctx)).toBe(true);
        expect(await isNotBannedAndUser(ctx)).toBe(false);
      });

      it("should implement De Morgan's law: not(A and B) === not(A) or not(B)", async () => {
        const notBoth = not(and(isAdmin, isBanned));
        const neitherOr = or(not(isAdmin), not(isBanned));

        // Test case 1: admin and banned
        const ctx1 = { user: { id: '1', role: 'admin', banned: true } as any };
        expect(await notBoth(ctx1)).toBe(false);
        expect(await neitherOr(ctx1)).toBe(false);

        // Test case 2: admin and not banned
        const ctx2 = { user: { id: '2', role: 'admin', banned: false } as any };
        expect(await notBoth(ctx2)).toBe(true);
        expect(await neitherOr(ctx2)).toBe(true);

        // Test case 3: not admin and banned
        const ctx3 = { user: { id: '3', role: 'user', banned: true } as any };
        expect(await notBoth(ctx3)).toBe(true);
        expect(await neitherOr(ctx3)).toBe(true);
      });
    });

    describe('not(or(...))', () => {
      it('should negate an or composition', async () => {
        const isAdminOrBanned = or(isAdmin, isBanned);
        const isNeitherAdminNorBanned = not(isAdminOrBanned);

        const ctx1 = { user: { id: '1', role: 'user', banned: false } as any };
        expect(await isNeitherAdminNorBanned(ctx1)).toBe(true);

        const ctx2 = { user: { id: '2', role: 'admin', banned: false } as any };
        expect(await isNeitherAdminNorBanned(ctx2)).toBe(false);
      });
    });

    describe('complex nesting', () => {
      it('should handle deeply nested operators', async () => {
        // Can comment if: authenticated AND (admin OR (user AND NOT banned))
        const canComment = and(isAuthenticated, or(isAdmin, and(isUser, not(isBanned))));

        // Admin can comment
        const ctx1 = { user: { id: '1', role: 'admin', banned: false } as any };
        expect(await canComment(ctx1)).toBe(true);

        // User (not banned) can comment
        const ctx2 = { user: { id: '2', role: 'user', banned: false } as any };
        expect(await canComment(ctx2)).toBe(true);

        // Banned user cannot comment
        const ctx3 = { user: { id: '3', role: 'user', banned: true } as any };
        expect(await canComment(ctx3)).toBe(false);
      });

      it('should handle not() wrapping complex compositions', async () => {
        const cannotModerate = not(and(isAuthenticated, or(isAdmin, isUser)));

        const ctx = { user: { id: '1', role: 'admin' } };
        expect(await cannotModerate(ctx)).toBe(false);
      });

      it('should work with triple nesting', async () => {
        const permission1 = or(and(isAdmin, not(isBanned)), and(isUser, not(isBanned)));

        const ctx1 = { user: { id: '1', role: 'admin', banned: false } as any };
        expect(await permission1(ctx1)).toBe(true);

        const ctx2 = { user: { id: '2', role: 'user', banned: true } as any };
        expect(await permission1(ctx2)).toBe(false);
      });
    });

    describe('double negation', () => {
      it('should return to original with not(not(...))', async () => {
        const notAdmin = not(isAdmin);
        const notNotAdmin = not(notAdmin);

        const ctx = { user: { id: '1', role: 'admin' } };

        expect(await isAdmin(ctx)).toBe(true);
        expect(await notAdmin(ctx)).toBe(false);
        expect(await notNotAdmin(ctx)).toBe(true);
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

      expect(await canView(ctx, historicalPost)).toBe(true);
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
      expect(await canView(ctx, regularPost as any)).toBe(true);
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

      expect(await canEdit(ctx, historicalPost)).toBe(true);
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
      expect(await canEdit(ctx1, post1)).toBe(true);

      // Owner cannot edit locked post
      const post2: Post = { id: '2', authorId: '1', published: true, locked: true };
      expect(await canEdit(ctx1, post2)).toBe(false);

      // Admin can edit locked post
      const ctx2 = { user: { id: '2', role: 'admin' } };
      expect(await canEdit(ctx2, post2)).toBe(true);
    });

    it('should handle: can view if published OR (authenticated AND owner)', async () => {
      const canView = or(isPublished, and(isPostOwner, isAuthenticated));

      // Anyone can view published post
      const ctx1 = { user: { id: '1', role: 'user' } };
      const post1: Post = { id: '1', authorId: '2', published: true };
      expect(await canView(ctx1, post1)).toBe(true);

      // Owner can view unpublished post
      const post2: Post = { id: '2', authorId: '1', published: false };
      expect(await canView(ctx1, post2)).toBe(true);

      // Non-owner cannot view unpublished post
      const post3: Post = { id: '3', authorId: '2', published: false };
      expect(await canView(ctx1, post3)).toBe(false);
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

      const editable = await canEdit.filter(ctx, posts);
      expect(editable).toHaveLength(2);
      expect(editable.map((p) => p.id)).toEqual(['1', '3']);
    });

    it('should work with orThrow for complex permissions', async () => {
      const canPublish = and(isPostOwner, isAuthenticated, not(isPublished));

      const ctx = { user: { id: '1', role: 'user' } };

      // Can publish unpublished owned post
      const post1: Post = { id: '1', authorId: '1', published: false };
      await expect(canPublish.orThrow(ctx, post1)).resolves.toBeUndefined();

      // Cannot publish already published post
      const post2: Post = { id: '2', authorId: '1', published: true };
      await expect(canPublish.orThrow(ctx, post2)).rejects.toThrow(ForbiddenError);

      // Cannot publish someone else's post
      const post3: Post = { id: '3', authorId: '2', published: false };
      await expect(canPublish.orThrow(ctx, post3)).rejects.toThrow(ForbiddenError);
    });
  });
});
