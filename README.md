# whocando

> Who can do what in your app?

Composable, type-safe, **async-first** authorization for TypeScript.

[![npm version](https://img.shields.io/npm/v/whocando.svg)](https://www.npmjs.com/package/whocando)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why whocando?

✨ **Composable** - Build complex permissions from simple rules  
🔒 **Type-safe** - Full TypeScript inference with generic contexts  
⚡ **Async-first** - Works seamlessly with databases, APIs, and DataLoader  
🎯 **Simple API** - Just `can()`, `authorize()`, and `filter()`  
🔧 **Framework-agnostic** - Works everywhere  
🪶 **Zero dependencies**  

## Quick Start

```typescript
import { permission, or, and, can, authorize, filter } from 'whocando';

// 1. Define your types
type AppContext = {
  user: { id: string; role: string };
  db: Database;
};

type Post = {
  id: string;
  authorId: string;
  title: string;
};

// 2. Create permissions (sync or async!)
// Without resource - simple checks
const isAuthenticated = permission(
  'isAuthenticated',
  (ctx: AppContext) => !!ctx.user
);

const isAdmin = permission(
  'isAdmin',
  (ctx: AppContext) => ctx.user.role === 'admin'
);

// With resource - entity-specific checks
const isPostOwner = permission(
  'isPostOwner',
  async (ctx: AppContext, post: Post) => {
    if (!post) return false;
    return post.authorId === ctx.user.id;
  }
);

// 3. Compose permissions
const canEditPost = or(isPostOwner, isAdmin);

// 4. Use permissions
const ctx: AppContext = { user: { id: '1', role: 'user' }, db };

// Without resource
if (await can(ctx, isAuthenticated)) {
  console.log('User is logged in');
}

// With resource
const post = await db.getPost('123');
if (await can(ctx, canEditPost, post)) {
  await db.updatePost(post);
}

// Require permission (throws if denied)
await authorize(ctx, isAuthenticated);
await authorize(ctx, canEditPost, post);

// Filter array of resources
const allPosts = await db.getPosts();
const editablePosts = await filter(ctx, canEditPost, allPosts);
```

## Installation

```bash
npm install whocando
```

## Core Concepts

### Permissions

A permission is a named function that checks if an action is allowed. It can be **sync or async**:

```typescript
// Sync permission - simple checks
const isAdmin = permission(
  'isAdmin',
  (ctx: AppContext) => ctx.user.role === 'admin'
);

// Async permission - database queries, API calls
const isPostOwner = permission(
  'isPostOwner',
  async (ctx: AppContext, post: Post) => {
    const fullPost = await ctx.db.post.findUnique({ where: { id: post.id } });
    return fullPost.authorId === ctx.user.id;
  }
);

// Factory function for reusable patterns
const hasRole = (role: string) => permission(
  `hasRole:${role}`,
  (ctx: AppContext) => ctx.user.roles.includes(role)
);

const isModerator = hasRole('moderator');
```

### Operators

Combine permissions with `or()`, `and()`, and `not()`:

```typescript
// OR - any permission must allow (runs checks in parallel!)
const canEdit = or(isOwner, isAdmin, isModerator);

// AND - all permissions must allow (runs sequentially, stops on first false)
const canPublish = and(isAuthenticated, isOwner, hasVerifiedEmail);

// NOT - negate permission
const canComment = and(isAuthenticated, not(isBanned));

// Complex compositions
const canModerate = and(
  isAuthenticated,
  or(isAdmin, and(isModerator, hasVerifiedEmail))
);
```

**Performance:** `or()` runs all checks in parallel for better performance with async permissions. This is especially powerful with DataLoader, as all database queries will be batched together! `and()` runs sequentially and stops at the first failure, which is optimal when you have expensive checks ordered after cheap ones.

### Checking Permissions

Three ways to check permissions:

```typescript
// 1. can() - Returns boolean
if (await can(ctx, canEdit, post)) {
  await updatePost(post);
}

// 2. authorize() - Throws if denied
await authorize(ctx, canDelete, post);
await deletePost(post);

// 3. filter() - Filter array to allowed items
const allPosts = await getPosts();
const editablePosts = await filter(ctx, canEdit, allPosts);
```

### Context Binding

Use `withContext()` to avoid passing context repeatedly:

```typescript
// Without binding - repetitive
if (await can(ctx, canRead, post)) { }
await authorize(ctx, canEdit, post);
const editable = await filter(ctx, canDelete, posts);

// With binding - cleaner
const { can, authorize, filter } = withContext(ctx);
if (await can(canRead, post)) { }
await authorize(canEdit, post);
const editable = await filter(canDelete, posts);
```

### Enhanced Context with Abilities

Use `withAbility()` to create an enhanced context with permission methods attached. Since it spreads the original context, you can destructure both context properties and permission methods:

```typescript
// Returns context + permission methods
const enhancedCtx = withAbility(ctx);
// enhancedCtx = { ...ctx, can, authorize, filter }

// Destructure what you need - context properties AND permission methods
const { user, db, authorize, filter } = enhancedCtx;

console.log(user.id);  // Original context property
await authorize(canEdit, post);  // Permission method
const filtered = await filter(canRead, posts);

// Perfect for middleware - enhance the context itself
// Express
app.use((req, res, next) => {
  req.ability = withAbility(getContext(req));
  next();
});

// Then use: const { authorize, user } = req.ability;

// Hono
app.use('*', async (c, next) => {
  c.set('ctx', withAbility(getBaseContext(c)));
  await next();
});

// Then use: const { authorize, user } = c.get('ctx');
```

## Examples

### Express.js REST API

```typescript
import express from 'express';
import { withAbility, permission, or, UnauthorizedError, ForbiddenError } from 'whocando';

const app = express();

// Define permissions
const isAdmin = permission('isAdmin', (ctx) => ctx.user?.role === 'admin');
const isPostOwner = permission('isPostOwner', async (ctx, post) => {
  return post?.authorId === ctx.user?.id;
});
const canDeletePost = or(isPostOwner, isAdmin);

// Middleware: Attach ability to request
app.use((req, res, next) => {
  const ctx = {
    user: req.user, // From auth middleware
    db: req.db,
  };
  req.ability = withAbility(ctx);
  next();
});

// Destructure permission methods from enhanced context
app.delete('/posts/:id', async (req, res) => {
  try {
    const { authorize, db } = req.ability;
    const post = await db.post.findUnique({ 
      where: { id: req.params.id } 
    });
    
    await authorize(canDeletePost, post);
    await db.post.delete({ where: { id: req.params.id } });
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({ error: error.message });
    }
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    throw error;
  }
});

// Destructure both context and permission methods
app.get('/posts/editable', async (req, res) => {
  const { filter, user, db } = req.ability;
  const allPosts = await db.post.findMany();
  const editablePosts = await filter(canEditPost, allPosts);
  res.json({ userId: user.id, posts: editablePosts });
});
```

### Hono REST API

```typescript
import { Hono } from 'hono';
import { withAbility, withContext, UnauthorizedError, ForbiddenError } from 'whocando';

const app = new Hono();

// Middleware: Enhance context with abilities
app.use('*', async (c, next) => {
  const baseCtx = {
    user: c.get('user'), // From auth middleware
    loaders: c.get('loaders'),
  };
  // withAbility returns { ...baseCtx, can, authorize, filter }
  c.set('ctx', withAbility(baseCtx));
  await next();
});

// Destructure permission methods directly from enhanced context
app.delete('/posts/:id', async (c) => {
  try {
    const { authorize } = c.get('ctx');
    const post = await getPost(c.req.param('id'));
    
    await authorize(canDelete, post);
    await deletePost(post);
    
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return c.json({ error: error.message }, 401);
    }
    if (error instanceof ForbiddenError) {
      return c.json({ error: error.message }, 403);
    }
    throw error;
  }
});

// Destructure both context properties and permission methods
app.get('/posts/my', async (c) => {
  const { user, filter } = c.get('ctx');
  
  const allPosts = await getPosts();
  const myPosts = await filter(canEdit, allPosts);
  
  return c.json({ userId: user.id, posts: myPosts });
});

// Alternative: Using withContext - just permissions
app.put('/posts/:id', async (c) => {
  try {
    const baseCtx = { user: c.get('user'), loaders: c.get('loaders') };
    const { authorize } = withContext(baseCtx);
    
    const post = await getPost(c.req.param('id'));
    await authorize(canEdit, post);
    
    return c.json(await updatePost(post));
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return c.json({ error: error.message }, 403);
    }
    throw error;
  }
});
```

### GraphQL with DataLoader

```typescript
import DataLoader from 'dataloader';
import { permission, or, can, withContext } from 'whocando';

type AppContext = {
  user: User;
  loaders: {
    post: DataLoader<string, Post>;
  };
};

// Async permission using DataLoader
const isPostOwner = permission<AppContext, { id: string }>(
  'isPostOwner',
  async (ctx, post) => {
    if (!post) return false;
    const fullPost = await ctx.loaders.post.load(post.id);
    return fullPost.authorId === ctx.user.id;
  }
);

const canEditPost = or(isPostOwner, isAdmin);

// GraphQL resolvers
const resolvers = {
  Query: {
    posts: async (_, __, ctx: AppContext) => {
      const { filter } = withContext(ctx);
      const allPosts = await getAllPosts();
      
      // Filter to readable posts - DataLoader batches all checks!
      return filter(canReadPost, allPosts);
    },
  },
  
  Mutation: {
    updatePost: async (_, { id, input }, ctx: AppContext) => {
      const { authorize } = withContext(ctx);
      const post = await ctx.loaders.post.load(id);
      
      await authorize(canEditPost, post);
      return updatePost(id, input);
    },
  },
  
  Post: {
    // Field-level permissions
    // When resolving 100 posts, DataLoader batches into 1 query!
    canEdit: (post, _, ctx: AppContext) => can(ctx, canEditPost, post),
    canDelete: (post, _, ctx: AppContext) => can(ctx, canDeletePost, post),
  },
};
```

**Performance with DataLoader:**

```typescript
// When GraphQL resolves 100 posts with canEdit field:
// - Without DataLoader: 100+ queries
// - With DataLoader: 1 batched query! 🚀
```

### Next.js Server Actions

```typescript
'use server';

import { authorize } from 'whocando';
import { getContext } from '@/lib/auth';

export async function deletePost(postId: string) {
  const ctx = await getContext();
  const post = await db.post.findUnique({ where: { id: postId } });
  
  await authorize(ctx, canDeletePost, post);
  
  await db.post.delete({ where: { id: postId } });
}
```

## API Reference

### `permission(name, check)`

Create a permission. The check function can be sync or async. Use explicit types in the function signature for clarity.

```typescript
// Recommended: explicit types
const isAdmin = permission(
  'isAdmin',
  (ctx: AppContext) => ctx.user.role === 'admin'
);

// Also works: with generics
const isAdmin = permission<AppContext>(
  'isAdmin',
  (ctx) => ctx.user.role === 'admin'
);
```

### `or(...permissions)`

Combine permissions with OR logic (any must allow). Runs all checks in **parallel** for better performance.

```typescript
const canEdit = or(isOwner, isAdmin, isModerator);
```

**Performance:** All permission checks run in parallel. This is especially beneficial with async permissions and DataLoader, as all database queries will be batched together into a single query.

### `and(...permissions)`

Combine permissions with AND logic (all must allow). Runs checks **sequentially** and stops at the first failure.

```typescript
const canPublish = and(isAuthenticated, isOwner, hasVerifiedEmail);
```

**Performance:** Checks run sequentially and stop at the first `false`, which is optimal when you order cheap checks (like `isAuthenticated`) before expensive ones (like database queries).

### `not(permission)`

Negate a permission.

```typescript
const canComment = and(isAuthenticated, not(isBanned));
```

### `can(ctx, permission, resource?)`

Check if permission allows access. Returns `Promise<boolean>`.

```typescript
if (await can(ctx, canEdit, post)) {
  await updatePost(post);
}
```

### `authorize(ctx, permission, resource?, options?)`

Require permission or throw `ForbiddenError`. Returns `Promise<void>`.

```typescript
// Basic
await authorize(ctx, canDelete, post);

// Custom error message
await authorize(ctx, canDelete, post, { 
  error: 'You cannot delete this post' 
});
```

### `filter(ctx, permission, resources)`

Filter array to only allowed items. Returns `Promise<T[]>`.

```typescript
const allPosts = await getPosts();
const editablePosts = await filter(ctx, canEdit, allPosts);
```

### `withContext(ctx)`

Create permission utilities bound to a context. Returns just the permission methods.

```typescript
const { can, authorize, filter } = withContext(ctx);

await authorize(canRead);
const posts = await filter(canEdit, allPosts);
```

### `withAbility(ctx)`

Create an enhanced context with permission methods attached. Returns the context spread with permission utilities. Since it includes the original context, you can destructure both context properties and permission methods.

```typescript
const enhancedCtx = withAbility(ctx);
// enhancedCtx = { ...ctx, can, authorize, filter }

// Destructure what you need - works with both!
const { user, db, authorize, filter } = enhancedCtx;

console.log(user.id);  // Original context property
await authorize(canEdit, post);  // Permission method
const filtered = await filter(canRead, posts);

// Perfect for middleware - enhance context in-place
// Express
app.use((req, res, next) => {
  req.ability = withAbility(getContext(req));
  next();
});
// Then: const { authorize, user } = req.ability;

// Hono - store as 'ctx' since it includes everything
app.use('*', async (c, next) => {
  c.set('ctx', withAbility(getBaseContext(c)));
  await next();
});
// Then: const { authorize, user } = c.get('ctx');
```

## Error Handling

### Built-in Errors

```typescript
import { UnauthorizedError, ForbiddenError } from 'whocando';

try {
  await authorize(ctx, canDelete, post);
} catch (error) {
  if (error instanceof UnauthorizedError) {
    return c.json({ error: 'Please log in' }, 401);
  }
  if (error instanceof ForbiddenError) {
    return c.json({ error: 'Access denied' }, 403);
  }
  throw error;
}
```

### Custom Errors

```typescript
// Custom message
await authorize(ctx, canDelete, post, { 
  error: 'You cannot delete this post' 
});

// Custom error instance
await authorize(ctx, canDelete, post, {
  error: new CustomError('Denied')
});

// Error factory
await authorize(ctx, canDelete, post, {
  error: () => new Error(`User ${ctx.user.id} cannot delete`)
});
```

## Best Practices

### 1. Always Use `await`

Enable ESLint to catch missing `await`:

```bash
npm install -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**`.eslintrc.js`:**
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
  },
};
```

This catches:
```typescript
authorize(ctx, canDelete, post); // ❌ ESLint error: Missing await
await authorize(ctx, canDelete, post); // ✅ Correct
```

### 2. Use DataLoader for Database Queries

```typescript
// ❌ N+1 queries
const isOwner = permission('isOwner',
  async (ctx, post) => {
    const fullPost = await db.post.findUnique({ where: { id: post.id } });
    return fullPost.authorId === ctx.user.id;
  }
);

// ✅ Batched with DataLoader
const isOwner = permission('isOwner',
  async (ctx, post) => {
    const fullPost = await ctx.loaders.post.load(post.id);
    return fullPost.authorId === ctx.user.id;
  }
);
```

### 3. Compose, Don't Duplicate

```typescript
// ✅ Define once, reuse
const isOwnerOrAdmin = or(isOwner, isAdmin);
const canEdit = isOwnerOrAdmin;
const canDelete = and(isOwnerOrAdmin, not(isArchived));
```

### 4. Name Permissions Clearly

```typescript
// ✅ Descriptive names
const isAdmin = permission('isAdmin', ...);
const canEditPost = permission('canEditPost', ...);
const hasVerifiedEmail = permission('hasVerifiedEmail', ...);
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { can, authorize, ForbiddenError } from 'whocando';

describe('permissions', () => {
  it('should allow admin to edit any post', async () => {
    const ctx = { user: { id: '1', role: 'admin' } };
    const post = { authorId: '999' };
    
    expect(await can(ctx, canEditPost, post)).toBe(true);
  });
  
  it('should deny non-owner', async () => {
    const ctx = { user: { id: '1', role: 'user' } };
    const post = { authorId: '2' };
    
    expect(await can(ctx, canEditPost, post)).toBe(false);
    await expect(authorize(ctx, canEditPost, post)).rejects.toThrow(ForbiddenError);
  });
});
```

## Philosophy

`whocando` follows the Drizzle ORM philosophy:

- **Composable** - Build complex from simple
- **Type-safe** - TypeScript-first
- **Explicit** - No magic
- **Lightweight** - Minimal abstraction

Just like you compose Drizzle queries with `and()`, `or()`, `eq()`, you compose permissions the same way.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.