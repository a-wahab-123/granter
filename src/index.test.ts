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
  ForbiddenError 
} from './index';

type TestContext = {
  user: { id: string; role: string };
};

describe('whocando', () => {
  const isAdmin = permission<TestContext>(
    'isAdmin', 
    (ctx) => ctx.user.role === 'admin'
  );
  
  const isUser = permission<TestContext>(
    'isUser', 
    (ctx) => ctx.user.role === 'user'
  );
  
  const isOwner = permission<TestContext, { authorId: string }>(
    'isOwner',
    (ctx, resource) => resource?.authorId === ctx.user.id
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
      const post = { authorId: '1' };
      expect(await can(ctx, isOwner, post)).toBe(true);
    });
  });

  describe('or', () => {
    it('should allow if any permission allows', async () => {
      const canAccess = or(isAdmin, isUser);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, canAccess)).toBe(true);
    });

    it('should deny if all permissions deny', async () => {
      const isGuest = permission<TestContext>(
        'isGuest',
        (ctx) => ctx.user.role === 'guest'
      );
      const canAccess = or(isAdmin, isGuest);
      const ctx = { user: { id: '1', role: 'other' } };
      expect(await can(ctx, canAccess)).toBe(false);
    });

    it('should work with multiple permissions', async () => {
      const canAccess = or(isAdmin, isUser, isOwner);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, canAccess)).toBe(true);
    });

    it('should run all checks in parallel', async () => {
      const checkOrder: number[] = [];
      
      const perm1 = permission<TestContext>(
        'perm1',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          checkOrder.push(1);
          return false;
        }
      );
      
      const perm2 = permission<TestContext>(
        'perm2',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          checkOrder.push(2);
          return false;
        }
      );
      
      const perm3 = permission<TestContext>(
        'perm3',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          checkOrder.push(3);
          return false;
        }
      );

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
        return permission<TestContext>(
          `batched${id}`,
          async () => {
            batchedChecks.push(id);
            // If this is the first check in current tick, increment batch count
            if (batchedChecks.length === 1) {
              batchCount++;
            }
            return allowed;
          }
        );
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
      const isAuthenticated = permission<TestContext>(
        'isAuthenticated',
        (ctx) => !!ctx.user
      );
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
      const posts = [
        { authorId: '1' },
        { authorId: '2' },
        { authorId: '1' },
      ];
      
      const ctx = { user: { id: '1', role: 'user' } };
      const owned = await filter(ctx, isOwner, posts);
      
      expect(owned).toHaveLength(2);
      expect(owned.every(p => p.authorId === '1')).toBe(true);
    });

    it('should return empty array if no items allowed', async () => {
      const posts = [{ authorId: '2' }, { authorId: '3' }];
      const ctx = { user: { id: '1', role: 'user' } };
      const owned = await filter(ctx, isOwner, posts);
      
      expect(owned).toHaveLength(0);
    });
  });

  describe('withContext', () => {  // Changed from 'createChecker'
    it('should create bound permissions', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const bound = withContext(ctx);  // Changed
      
      expect(await bound.can(isAdmin)).toBe(true);
    });
  
    it('should work with resources', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      const bound = withContext(ctx);  // Changed
      const post = { authorId: '1' };
      
      expect(await bound.can(isOwner, post)).toBe(true);
    });
  
    it('should authorize correctly', async () => {
      const ctx = { user: { id: '1', role: 'admin' } };
      const bound = withContext(ctx);  // Changed
      
      await expect(bound.authorize(isAdmin)).resolves.toBeUndefined();
    });
  
    it('should filter correctly', async () => {
      const ctx = { user: { id: '1', role: 'user' } };
      const bound = withContext(ctx);  // Changed
      const posts = [
        { authorId: '1' },
        { authorId: '2' },
      ];
      
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
      const posts = [
        { authorId: '1' },
        { authorId: '2' },
        { authorId: '1' },
      ];
      
      const owned = await enhanced.filter(isOwner, posts);
      expect(owned).toHaveLength(2);
      expect(owned.every(p => p.authorId === '1')).toBe(true);
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
      const asyncPerm = permission<TestContext>(
        'asyncPerm',
        async (ctx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return ctx.user.role === 'admin';
        }
      );

      const ctx = { user: { id: '1', role: 'admin' } };
      expect(await can(ctx, asyncPerm)).toBe(true);
    });

    it('should work in compositions with async permissions', async () => {
      const asyncPerm = permission<TestContext>(
        'asyncPerm',
        async (ctx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return ctx.user.role === 'admin';
        }
      );

      const combined = or(asyncPerm, isUser);
      const ctx = { user: { id: '1', role: 'user' } };
      expect(await can(ctx, combined)).toBe(true);
    });
  });
});