# granter

> Composable, type-safe authorization for TypeScript

[![npm version](https://img.shields.io/npm/v/granter.svg)](https://www.npmjs.com/package/granter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**📚 [Read the full documentation →](https://seeden.github.io/granter)**

## Why granter?

✨ **Composable** - Build complex permissions from simple rules  
🔒 **Type-safe** - Full TypeScript inference with generic contexts  
⚡ **Async-first** - Works seamlessly with databases, APIs, and DataLoader  
🔧 **Framework-agnostic** - Works with Express, Hono, Next.js, GraphQL, and more  
🪶 **Zero dependencies** - Lightweight and performant

## Quick Example

```typescript
import { permission, or } from 'granter';

// Define permissions
const isAdmin = permission('isAdmin', (ctx) => ctx.user.role === 'admin');

const isPostOwner = permission('isPostOwner', (ctx, post) => post.authorId === ctx.user.id);

// Compose permissions
const canEditPost = or(isPostOwner, isAdmin);

// Use them - permissions are callable!
if (await canEditPost(ctx, post)) {
  await updatePost(post);
}

// Require permission (throws if denied)
await canEditPost.orThrow(ctx, post);

// Filter arrays
const editablePosts = await canEditPost.filter(ctx, allPosts);

// Debug permission checks
const explanation = await canEditPost.explain(ctx, post);
```

## Installation

```bash
npm install granter
```

## Documentation

Visit **[seeden.github.io/granter](https://seeden.github.io/granter)** for the complete documentation:

- **[Getting Started](https://seeden.github.io/granter/docs/getting-started)** - Install and use granter in 5 minutes
- **[Core Concepts](https://seeden.github.io/granter/docs/permissions)** - Learn about permissions, operators, and methods
- **[Express Example](https://seeden.github.io/granter/docs/express)** - Complete REST API example
- **[API Reference](https://seeden.github.io/granter/docs/api-reference)** - Full API documentation

## Key Features

### Composable Operators

```typescript
import { and, or, not } from 'granter';

// Combine with OR (any must pass)
const canEdit = or(isPostOwner, isAdmin, isModerator);

// Combine with AND (all must pass)
const canPublish = and(isAuthenticated, isVerified, isPostOwner);

// Negate permissions
const canComment = and(isAuthenticated, not(isBanned));
```

### Powerful Methods

```typescript
// Check permission (returns boolean)
if (await canEdit(ctx, post)) {
  /* ... */
}

// Require permission (throws if denied)
await canEdit.orThrow(ctx, post);

// Filter arrays to allowed items
const editable = await canEdit.filter(ctx, allPosts);

// Debug permission checks
const explanation = await canEdit.explain(ctx, post);
```

### Simplify with `withContext()`

```typescript
import { withContext } from 'granter';

const abilities = withContext(ctx, {
  canEditPost,
  canDeletePost,
});

// No need to pass ctx anymore!
if (await abilities.canEditPost(post)) {
  await updatePost(post);
}
```

## Framework Examples

granter works with any TypeScript project. See the [documentation](https://seeden.github.io/granter) for complete examples with:

- **[Express.js](https://seeden.github.io/granter/docs/express)** - REST API with middleware
- **[Next.js](https://seeden.github.io/granter/docs/nextjs)** - Server Actions and App Router
- **[GraphQL](https://seeden.github.io/granter/docs/graphql)** - Apollo Server with DataLoader
- **[React](https://seeden.github.io/granter/docs/react)** - Context and hooks patterns

## Authentication Integration

granter is **authorization-only** and works with any authentication library:

- [Auth.js / NextAuth.js](https://seeden.github.io/granter/docs/auth-js)
- [Clerk](https://seeden.github.io/granter/docs/clerk)
- [Supabase Auth](https://seeden.github.io/granter/docs/supabase)
- Custom JWT/Sessions
- And more...

See the [Authentication Integration](https://seeden.github.io/granter/docs) guide for complete examples.

## TypeScript Support

granter is built with TypeScript and provides full type inference:

```typescript
type AppContext = {
  user: { id: string; role: string };
  db: Database;
};

type Post = {
  id: string;
  authorId: string;
};

const canEdit = or(isPostOwner, isAdmin);

// ✅ Type-safe: ctx and post are fully typed
await canEdit(ctx, post);

// ❌ TypeScript error: missing resource
await canEdit(ctx);
```

## Testing

Permissions are pure functions, making them easy to test:

```typescript
import { describe, it, expect } from 'vitest';

describe('canEditPost', () => {
  it('allows post owner', async () => {
    const ctx = { user: { id: '1', role: 'user' }, db };
    const post = { id: '123', authorId: '1' };

    expect(await canEditPost(ctx, post)).toBe(true);
  });

  it('allows admin', async () => {
    const ctx = { user: { id: '2', role: 'admin' }, db };
    const post = { id: '123', authorId: '1' };

    expect(await canEditPost(ctx, post)).toBe(true);
  });

  it('denies other users', async () => {
    const ctx = { user: { id: '3', role: 'user' }, db };
    const post = { id: '123', authorId: '1' };

    expect(await canEditPost(ctx, post)).toBe(false);
  });
});
```

## Advanced Features

### Parallel Operators

Use `orParallel()` and `andParallel()` for DataLoader batching:

```typescript
import { orParallel, andParallel } from 'granter';

// Run all checks in parallel (no short-circuit)
const canEdit = orParallel(isPostOwner, isAdmin, isModerator);
```

**[Learn more about parallel execution →](https://seeden.github.io/granter/docs/parallel-execution)**

### Debug with `.explain()`

Understand why permissions passed or failed:

```typescript
const explanation = await canEdit.explain(ctx, post);
console.log(JSON.stringify(explanation, null, 2));
// {
//   "name": "(isPostOwner OR isAdmin)",
//   "value": false,
//   "duration": 15.23,
//   "children": [
//     { "name": "isPostOwner", "value": false, "duration": 8.12 },
//     { "name": "isAdmin", "value": false, "duration": 7.11 }
//   ]
// }
```

**[Learn more about debugging →](https://seeden.github.io/granter/docs/debugging)**

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [seeden](https://github.com/seeden)

---

**📚 [View Full Documentation](https://seeden.github.io/granter)** | **[GitHub](https://github.com/seeden/granter)** | **[npm](https://www.npmjs.com/package/granter)**
