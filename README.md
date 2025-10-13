# granter

> Composable, type-safe authorization for TypeScript

[![npm version](https://img.shields.io/npm/v/granter.svg)](https://www.npmjs.com/package/granter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why granter?

✨ **Composable** - Build complex permissions from simple rules  
🔒 **Type-safe** - Full TypeScript inference with generic contexts  
⚡ **Async-first** - Works seamlessly with databases, APIs, and DataLoader  
🔧 **Framework-agnostic** - Works everywhere  
🪶 **Zero dependencies**

## Quick Start

```typescript
import { permission, or, and } from 'granter';

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
const isAuthenticated = permission('isAuthenticated', (ctx: AppContext) => !!ctx.user);

const isAdmin = permission('isAdmin', (ctx: AppContext) => ctx.user.role === 'admin');

// With resource - entity-specific checks
const isPostOwner = permission('isPostOwner', async (ctx: AppContext, post: Post) => {
  return post.authorId === ctx.user.id;
});

// 3. Compose permissions
const canEditPost = or(isPostOwner, isAdmin);

// 4. Use permissions - Permissions are callable!
const ctx: AppContext = { user: { id: '1', role: 'user' }, db };

// Direct call - returns boolean
if (await isAuthenticated(ctx)) {
  console.log('User is logged in');
}

// With resource
const post = await db.getPost('123');
if (await canEditPost(ctx, post)) {
  await db.updatePost(post);
}

// Require permission (throws if denied)
await canEditPost.orThrow(ctx, post);
await canEditPost.orThrow(ctx, post, 'You cannot edit this post');

// Filter array of resources
const allPosts = await db.getPosts();
const editablePosts = await canEditPost.filter(ctx, allPosts);

// Debug why permission was denied
const explanation = await canEditPost.explain(ctx, post);
console.log(explanation);
// {
//   name: "(isPostOwner OR isAdmin)",
//   value: false,
//   duration: 15.23,
//   children: [
//     { name: "isPostOwner", value: false, duration: 8.12 },
//     { name: "isAdmin", value: false, duration: 7.11 }
//   ]
// }

// 5. Optional: Bind context for cleaner code
import { withContext } from 'granter';

const abilities = withContext(ctx, {
  canEditPost,
  isAdmin,
});

// No need to pass ctx anymore!
if (await abilities.canEditPost(post)) {
  await db.updatePost(post);
}
```

## Installation

```bash
npm install granter
```

## Core Concepts

### Authentication vs Authorization

**granter** is an **authorization** library (authz), not an **authentication** library (authn). Understanding the difference is crucial:

- **Authentication (authn)**: _Who are you?_ - Verifying identity (login, passwords, OAuth, JWT)
- **Authorization (authz)**: _What can you do?_ - Checking permissions and access control

```
┌─────────────────┐    ┌──────────────┐    ┌─────────┐    ┌──────────┐
│ Auth Library    │ -> │ Create       │ -> │ granter │ -> │ Your App │
│ (Clerk, Auth.js)│    │ Context      │    │ (authz) │    │ Logic    │
└─────────────────┘    └──────────────┘    └─────────┘    └──────────┘
   Who are you?         Enrich context      What can       Execute
                                            you do?         action
```

**granter assumes you already have an authenticated user.** It focuses solely on what that user can do:

```typescript
// ✅ You handle authentication (any way you want)
const session = await getSession(); // Clerk, Auth.js, Passport, custom, etc.

// ✅ granter handles authorization
const ctx = { user: session.user, db };
await canDeletePost.orThrow(ctx, post);
```

This separation means granter works with **any** authentication system - no lock-in, full flexibility.

### Permissions

A permission is a named function that checks if an action is allowed. It can be **sync or async**:

```typescript
// Sync permission - simple checks
const isAdmin = permission('isAdmin', (ctx: AppContext) => ctx.user.role === 'admin');

// Async permission - database queries, API calls
const isPostOwner = permission('isPostOwner', async (ctx: AppContext, post: Post) => {
  const fullPost = await ctx.db.post.findUnique({ where: { id: post.id } });
  return fullPost.authorId === ctx.user.id;
});

// Factory function for reusable patterns
const hasRole = (role: string) =>
  permission(`hasRole:${role}`, (ctx: AppContext) => ctx.user.roles.includes(role));

const isModerator = hasRole('moderator');
```

### Operators

Combine permissions with `or()`, `and()`, and `not()`:

```typescript
// OR - any permission must allow (runs sequentially, stops on first success)
const canEdit = or(isOwner, isAdmin, isModerator);

// AND - all permissions must allow (runs sequentially, stops on first failure)
const canPublish = and(isAuthenticated, isOwner, hasVerifiedEmail);

// NOT - negate permission
const canComment = and(isAuthenticated, not(isBanned));

// Complex compositions - operators can be nested arbitrarily
const canModerate = and(isAuthenticated, or(isAdmin, and(isModerator, hasVerifiedEmail)));

// not() can wrap any composed permission
const isNeitherOwnerNorAdmin = not(or(isOwner, isAdmin));
const cannotEditOrDelete = not(and(isAuthenticated, or(isOwner, isAdmin)));
```

**Type Safety:** Operators ensure all permissions work on compatible resource types:

```typescript
type Post = { id: string; authorId: string };
type Comment = { id: string; authorId: string; postId: string };

const isPostOwner = permission('isPostOwner', (ctx, post?: Post) => post?.authorId === ctx.user.id);

const isCommentOwner = permission(
  'isCommentOwner',
  (ctx, comment?: Comment) => comment?.authorId === ctx.user.id
);

// ✅ Allowed: Same resource type
const canEditPost = or(isPostOwner, isAdmin);

// ✅ Allowed: Mix resource-less with resource-specific
const canDeletePost = and(isAuthenticated, isPostOwner);

// ❌ Prevented: Mixing incompatible resource types
const mixed = or(isCommentOwner, isPostOwner); // TypeScript error!
```

**Performance:** Both `or()` and `and()` run sequentially with short-circuit evaluation by default:

- `or()` stops at the first success (efficient when early checks are likely to pass)
- `and()` stops at the first failure (efficient when you order cheap checks first)

For DataLoader batching, use the parallel variants `orParallel()` and `andParallel()` (see Advanced section below).

### Using Permissions

Permissions are callable functions with methods:

```typescript
// 1. Direct call - Returns boolean
if (await canEdit(ctx, post)) {
  await updatePost(post);
}

// 2. orThrow() - Throws if denied
await canDelete.orThrow(ctx, post);
await deletePost(post);

// With custom error message
await canEdit.orThrow(ctx, post, 'You cannot edit this post');

// 3. filter() - Filter array to allowed items
const allPosts = await getPosts();
const editablePosts = await canEdit.filter(ctx, allPosts);

// 4. explain() - Debug permission checks
const explanation = await canEdit.explain(ctx, post);
console.log(explanation);
// Shows which permissions passed/failed and timing
```

### Permission Methods

Every permission has these methods:

| Method                            | Returns                      | Description                        |
| --------------------------------- | ---------------------------- | ---------------------------------- |
| `permission(ctx, resource)`       | `Promise<boolean>`           | Direct call - checks if allowed    |
| `.orThrow(ctx, resource, error?)` | `Promise<void>`              | Throws `ForbiddenError` if denied  |
| `.filter(ctx, resources)`         | `Promise<T[]>`               | Filter array to allowed items      |
| `.explain(ctx, resource)`         | `Promise<ExplanationResult>` | Debug why permission passed/failed |

### Simplifying with `withContext()`

When you need to call many permissions with the same context, use `withContext()` to bind the context once:

```typescript
import { withContext } from 'granter';

// Bind context to your permissions
const abilities = withContext(ctx, {
  canEditPost,
  canDeletePost,
  canViewPost,
});

// Now call without ctx!
if (await abilities.canEditPost(post)) {
  await updatePost(post);
}

if (await abilities.canDeletePost(post)) {
  await deletePost(post);
}
```

**Express.js middleware pattern:**

```typescript
app.use((req, res, next) => {
  const ctx = { user: req.user, db: req.app.locals.db };

  // Bind only the permissions you need
  req.abilities = withContext(ctx, {
    isAuthenticated,
    isAdmin,
    canEditPost,
    canDeletePost,
    canViewPost,
  });

  next();
});

// Use in routes without ctx!
app.put('/posts/:id', async (req, res) => {
  const post = await getPost(req.params.id);

  if (!(await req.abilities.canEditPost(post))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Update post...
});
```

**React context pattern:**

```typescript
const AbilitiesContext = createContext(null);

export function AbilitiesProvider({ children, user, db }) {
  const ctx = { user, db };

  const abilities = useMemo(
    () => withContext(ctx, {
      isAuthenticated,
      canEditPost,
      canDeletePost,
    }),
    [user, db]
  );

  return (
    <AbilitiesContext.Provider value={abilities}>
      {children}
    </AbilitiesContext.Provider>
  );
}

// Use in components
function PostCard({ post }) {
  const abilities = useContext(AbilitiesContext);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    abilities.canEditPost(post).then(setCanEdit);
  }, [post]);

  return (
    <div>
      {canEdit && <button>Edit</button>}
    </div>
  );
}
```

## Examples

### Express.js REST API

```typescript
import express from 'express';
import { permission, or, UnauthorizedError, ForbiddenError } from 'granter';

const app = express();

// Define permissions
const isAdmin = permission('isAdmin', (ctx) => ctx.user?.role === 'admin');
const isPostOwner = permission('isPostOwner', async (ctx, post) => {
  return post?.authorId === ctx.user?.id;
});
const canDeletePost = or(isPostOwner, isAdmin);

// Step 1: Authentication (happens first - use any auth library)
app.use(authenticateUser); // Your auth middleware (better-auth, Passport, JWT, etc.)

// Step 2: Create granter context from authenticated user
app.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.ctx = {
    user: req.user, // From auth middleware
    db: prisma,
  };
  next();
});

// Step 3: Use authorization in routes
app.delete('/posts/:id', async (req, res) => {
  try {
    const ctx = req.ctx;
    const post = await ctx.db.post.findUnique({
      where: { id: req.params.id },
    });

    await canDeletePost.orThrow(ctx, post);
    await ctx.db.post.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    throw error;
  }
});

// Using filter method
app.get('/posts/editable', async (req, res) => {
  const ctx = req.ctx;
  const allPosts = await ctx.db.post.findMany();
  const editablePosts = await canEditPost.filter(ctx, allPosts);
  res.json({ userId: ctx.user.id, posts: editablePosts });
});
```

### Hono REST API

```typescript
import { Hono } from 'hono';
import { permission, or, UnauthorizedError, ForbiddenError } from 'granter';

const app = new Hono();

// Step 1: Authentication (use any auth middleware)
app.use('*', authenticateUser); // Sets c.set('user', authenticatedUser)

// Step 2: Create granter context
app.use('*', async (c, next) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  c.set('ctx', {
    user,
    db: prisma,
    loaders: c.get('loaders'), // Optional: DataLoader for batching
  });
  await next();
});

// Use permissions directly
app.delete('/posts/:id', async (c) => {
  try {
    const ctx = c.get('ctx');
    const post = await getPost(c.req.param('id'));

    await canDelete.orThrow(ctx, post);
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

// Using filter method
app.get('/posts/my', async (c) => {
  const ctx = c.get('ctx');

  const allPosts = await getPosts();
  const myPosts = await canEdit.filter(ctx, allPosts);

  return c.json({ userId: ctx.user.id, posts: myPosts });
});
```

### GraphQL with DataLoader

```typescript
import { ApolloServer } from '@apollo/server';
import DataLoader from 'dataloader';
import { permission, or } from 'granter';

type AppContext = {
  user: User;
  loaders: {
    post: DataLoader<string, Post>;
  };
};

// Define permissions
const isPostOwner = permission<AppContext, { id: string }>('isPostOwner', async (ctx, post) => {
  if (!post) return false;
  const fullPost = await ctx.loaders.post.load(post.id);
  return fullPost.authorId === ctx.user.id;
});

const canEditPost = or(isPostOwner, isAdmin);

// Apollo Server setup
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    // Step 1: Authentication (extract and verify token)
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await verifyToken(token); // Your auth logic

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Step 2: Create context with DataLoader (for granter)
    return {
      user,
      loaders: {
        post: new DataLoader(async (ids) => {
          const posts = await db.post.findMany({
            where: { id: { in: ids } },
          });
          return ids.map((id) => posts.find((p) => p.id === id));
        }),
      },
    };
  },
});

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

import { auth } from '@/lib/auth'; // Auth.js, Clerk, or your auth solution
import { authorize } from 'granter';
import { canDeletePost } from '@/lib/permissions';
import { db } from '@/lib/db';

export async function deletePost(postId: string) {
  // Step 1: Authentication - verify user is logged in
  const session = await auth();
  if (!session?.user) {
    throw new Error('Not authenticated');
  }

  // Step 2: Create context for authorization
  const ctx = {
    user: session.user,
    db,
  };

  // Step 3: Authorization - check permissions
  const post = await db.post.findUnique({ where: { id: postId } });
  await authorize(ctx, canDeletePost, post);

  // Step 4: Execute action
  await db.post.delete({ where: { id: postId } });
}
```

## Authentication Integration

granter is **authorization-only** and works with any authentication system. This section shows how to integrate with popular auth libraries.

### Auth.js / NextAuth.js

[Auth.js](https://authjs.dev/) (formerly NextAuth.js) is the most popular auth library for Next.js.

**Next.js App Router with Server Actions:**

```typescript
// app/actions/posts.ts
'use server';

import { auth } from '@/lib/auth'; // Your Auth.js config
import { withAbility } from 'granter';
import { canDeletePost } from '@/lib/permissions';
import { db } from '@/lib/db';

export async function deletePost(postId: string) {
  // 1. Authentication - get session
  const session = await auth();
  if (!session?.user) {
    throw new Error('Not authenticated');
  }

  // 2. Create context for authorization
  const ctx = withAbility({
    user: session.user,
    db,
  });

  // 3. Authorization - check permissions
  const post = await db.post.findUnique({ where: { id: postId } });
  await ctx.authorize(canDeletePost, post);

  // 4. Execute action
  await db.post.delete({ where: { id: postId } });
}
```

**Middleware pattern:**

```typescript
// middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  // Auth.js attaches session to req.auth
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
});

// app/api/posts/[id]/route.ts
import { auth } from '@/lib/auth';
import { withAbility } from 'granter';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();

  const ctx = withAbility({
    user: session.user,
    db,
  });

  const post = await db.post.findUnique({ where: { id: params.id } });
  await ctx.authorize(canDeletePost, post);

  await db.post.delete({ where: { id: params.id } });
  return Response.json({ success: true });
}
```

### Clerk

[Clerk](https://clerk.com/) provides drop-in authentication with a great DX.

**With Hono:**

```typescript
import { Hono } from 'hono';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { withAbility } from 'granter';

const app = new Hono();

// 1. Clerk authentication middleware
app.use('*', clerkMiddleware());

// 2. Create granter context with Clerk user
app.use('*', async (c, next) => {
  const auth = getAuth(c);

  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Fetch full user details (or use cached)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE clerk_id = ?')
    .bind(auth.userId)
    .first();

  // Enhance context with granter abilities
  c.set(
    'ctx',
    withAbility({
      user,
      clerkUserId: auth.userId,
      db: c.env.DB,
    })
  );

  await next();
});

// 3. Use permissions in routes
app.delete('/posts/:id', async (c) => {
  const { authorize, user } = c.get('ctx');
  const post = await getPost(c.req.param('id'));

  await authorize(canDeletePost, post);
  await deletePost(post.id);

  return c.json({ success: true });
});
```

**With Express:**

```typescript
import express from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { withAbility } from 'granter';

const app = express();

// 1. Clerk authentication
app.use(ClerkExpressRequireAuth());

// 2. Create granter context
app.use((req, res, next) => {
  req.ability = withAbility({
    user: req.auth.user,
    clerkUserId: req.auth.userId,
    db: prisma,
  });
  next();
});

// 3. Use in routes
app.delete('/posts/:id', async (req, res) => {
  const { authorize } = req.ability;
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
  });

  await authorize(canDeletePost, post);
  await prisma.post.delete({ where: { id: req.params.id } });

  res.json({ success: true });
});
```

### Passport.js

[Passport](https://www.passportjs.org/) is the classic Express authentication middleware.

**With Local Strategy:**

```typescript
import express from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { withAbility, UnauthorizedError, ForbiddenError } from 'granter';

// 1. Configure Passport
passport.use(
  new LocalStrategy(async (username, password, done) => {
    const user = await db.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return done(null, false);
    }
    return done(null, user);
  })
);

const app = express();

// 2. Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// 3. Create granter context from Passport user
app.use(requireAuth);
app.use((req, res, next) => {
  req.ability = withAbility({
    user: req.user, // Passport attaches user here
    db: prisma,
  });
  next();
});

// 4. Use permissions
app.delete('/posts/:id', async (req, res) => {
  try {
    const { authorize } = req.ability;
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    await authorize(canDeletePost, post);
    await prisma.post.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    throw error;
  }
});
```

**With JWT Strategy:**

```typescript
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      const user = await db.user.findUnique({ where: { id: payload.sub } });
      return done(null, user || false);
    }
  )
);

// Then use the same pattern as above
app.use(passport.authenticate('jwt', { session: false }));
app.use((req, res, next) => {
  req.ability = withAbility({ user: req.user, db: prisma });
  next();
});
```

### Supabase Auth

[Supabase](https://supabase.com/) provides auth, database, and real-time subscriptions.

**With Next.js Server Components:**

```typescript
// app/actions/posts.ts
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withAbility } from 'granter';
import { canDeletePost } from '@/lib/permissions';

export async function deletePost(postId: string) {
  // 1. Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  );

  // 2. Get authenticated user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Not authenticated');
  }

  // 3. Create granter context
  const ctx = withAbility({
    user: {
      id: user.id,
      email: user.email,
      role: user.user_metadata.role,
    },
    supabase,
  });

  // 4. Check permissions
  const { data: post } = await supabase.from('posts').select('*').eq('id', postId).single();

  await ctx.authorize(canDeletePost, post);

  // 5. Execute delete
  await supabase.from('posts').delete().eq('id', postId);
}
```

**Combining with Row Level Security (RLS):**

```typescript
// Supabase RLS provides database-level security
// granter adds application-level permission logic

// You can use both together:
// - RLS: Ensures users can only see their own data at DB level
// - granter: Adds complex business rules (e.g., admins can see all)

const canViewPost = or(
  permission('isPostOwner', async (ctx, post) => {
    // RLS already filters, but we check for admin override
    return post.authorId === ctx.user.id;
  }),
  isAdmin // Admins bypass RLS with service role key
);
```

### Custom JWT / Sessions

**JWT Token Validation:**

```typescript
import jwt from 'jsonwebtoken';
import { withAbility } from 'granter';

const app = express();

// 1. JWT validation middleware
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify JWT
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user details
    const user = await db.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 2. Create granter context
    req.ability = withAbility({
      user,
      db,
      loaders: createDataLoaders(db), // Optional: add DataLoader
    });

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// 3. Use in routes
app.get('/posts', async (req, res) => {
  const { filter, user } = req.ability;
  const allPosts = await db.post.findMany();
  const viewable = await filter(canViewPost, allPosts);
  res.json(viewable);
});
```

**Cookie-based Sessions:**

```typescript
import session from 'express-session';

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new RedisStore({ client: redisClient }),
  })
);

// Session middleware
app.use(async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await db.user.findUnique({
    where: { id: req.session.userId },
  });

  req.ability = withAbility({ user, db });
  next();
});
```

### OAuth (Without Library)

**Google OAuth Example:**

```typescript
import { google } from 'googleapis';
import { withAbility } from 'granter';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// OAuth callback handler
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  // 1. Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // 2. Get user info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: googleUser } = await oauth2.userinfo.get();

  // 3. Find or create user in your DB
  let user = await db.user.findUnique({
    where: { email: googleUser.email },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
    });
  }

  // 4. Create session
  req.session.userId = user.id;

  res.redirect('/dashboard');
});

// Use in routes with granter
app.use(async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await db.user.findUnique({
    where: { id: req.session.userId },
  });

  req.ability = withAbility({ user, db });
  next();
});
```

**GitHub OAuth Example:**

```typescript
// Similar pattern - exchange code for access token
app.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const { access_token } = await tokenResponse.json();

  // Get user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const githubUser = await userResponse.json();

  // Create/find user, create session, etc.
  // Then use granter as shown above
});
```

### Best Practices

#### 1. Separate Authentication from Authorization

```typescript
// ✅ Good: Clear separation
async function deletePost(postId: string) {
  // Step 1: Authentication (handled by middleware/library)
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  // Step 2: Create context
  const ctx = { user: session.user, db };

  // Step 3: Authorization (granter)
  await authorize(ctx, canDelete, post);

  // Step 4: Execute
  await db.post.delete({ where: { id: postId } });
}

// ❌ Bad: Mixed concerns
async function deletePost(postId: string) {
  // Mixing auth and authz logic is confusing
  if (!user.isLoggedIn && !user.isAdmin && post.authorId !== user.id) {
    throw new Error('Access denied');
  }
}
```

#### 2. Design Your Context Carefully

```typescript
// ✅ Good: Include what you need for permissions
type AppContext = {
  user: {
    id: string;
    role: string;
    email: string;
    emailVerified: boolean;
  };
  db: PrismaClient;
  loaders?: DataLoaders; // Optional: for batching
};

// ❌ Bad: Don't expose sensitive data
type BadContext = {
  user: {
    password: string; // Never include!
    accessToken: string; // Don't pass tokens around
  };
};
```

#### 3. Handle 401 vs 403 Correctly

```typescript
// 401 Unauthorized: User is not authenticated
if (!session) {
  throw new UnauthorizedError('Please log in');
}

// 403 Forbidden: User is authenticated but lacks permission
await authorize(ctx, canDelete, post); // Throws ForbiddenError
```

#### 4. Use DataLoader for Performance

```typescript
// ✅ Good: Batch database queries
import DataLoader from 'dataloader';

const createLoaders = (db: PrismaClient) => ({
  user: new DataLoader(async (ids: string[]) => {
    const users = await db.user.findMany({
      where: { id: { in: ids } },
    });
    return ids.map((id) => users.find((u) => u.id === id));
  }),
});

// Use in context
const ctx = withAbility({
  user: session.user,
  loaders: createLoaders(db),
});

// Permission using loader
const isTeamMember = permission('isTeamMember', async (ctx, team) => {
  const member = await ctx.loaders.user.load(ctx.user.id);
  return member.teamIds.includes(team.id);
});
```

#### 5. Don't Validate Tokens in Permissions

```typescript
// ❌ Bad: Don't validate auth tokens in permissions
const isAdmin = permission('isAdmin', async (ctx) => {
  // Never do this - token validation belongs in auth middleware
  const valid = await validateToken(ctx.token);
  return valid && ctx.user.role === 'admin';
});

// ✅ Good: Assume authentication is already done
const isAdmin = permission('isAdmin', (ctx) => {
  return ctx.user.role === 'admin';
});
```

#### 6. Test with Mock Contexts

```typescript
import { describe, it, expect } from 'vitest';
import { can } from 'granter';

describe('permissions', () => {
  it('should allow admin to delete any post', async () => {
    // Easy to test - just create mock context
    const ctx = {
      user: { id: '1', role: 'admin' },
      db: mockDb,
    };

    const post = { id: '123', authorId: '999' };
    expect(await can(ctx, canDelete, post)).toBe(true);
  });
});
```

## Advanced

### Parallel Operators for DataLoader Batching

By default, `or()` and `and()` run sequentially with short-circuit evaluation. For most use cases, this is the right choice. However, when using DataLoader or similar batching libraries, you may want all checks to run in parallel so database queries can be batched together.

Use `orParallel()` and `andParallel()` for this:

```typescript
import { orParallel, andParallel } from 'granter';

// Example: Using DataLoader for batching
const userLoader = new DataLoader(async (ids) => {
  // Batch load multiple users at once
  return await db.users.findMany({ where: { id: { in: ids } } });
});

const isOwner = permission('isOwner', async (ctx, post: Post) => {
  const owner = await userLoader.load(post.authorId);
  return owner.id === ctx.user.id;
});

const isAdmin = permission('isAdmin', async (ctx) => {
  const user = await userLoader.load(ctx.user.id);
  return user.role === 'admin';
});

// Sequential (default) - checks run one by one
const canEditSeq = or(isOwner, isAdmin);
// If isOwner succeeds, isAdmin never runs

// Parallel - all checks run simultaneously
const canEditPar = orParallel(isOwner, isAdmin);
// Both checks run, allowing DataLoader to batch the user lookups

// Usage
await canEditPar(ctx, post);
// DataLoader batches both user lookups into a single database query!
```

**When to use parallel operators:**

- ✅ You're using DataLoader or similar batching
- ✅ Checks have similar cost/speed
- ✅ You want all checks to run (e.g., for metrics/logging)

**When to use sequential (default):**

- ✅ Early checks are likely to succeed (`or`) or fail (`and`)
- ✅ Early checks are much faster than later ones
- ✅ You want to minimize unnecessary work
- ✅ You're not using query batching

### Custom Error Types

You can throw custom errors with `orThrow()`:

```typescript
class PostNotFoundError extends Error {
  constructor(postId: string) {
    super(`Post ${postId} not found`);
    this.name = 'PostNotFoundError';
  }
}

// Throw custom error
await canEdit.orThrow(ctx, post, () => new PostNotFoundError(post.id));

// Throw with string (wraps in ForbiddenError)
await canEdit.orThrow(ctx, post, 'You cannot edit this post');

// Throw with Error instance
await canEdit.orThrow(ctx, post, new UnauthorizedError('Login required'));
```

## API Reference

### `permission(name, check)`

Create a permission. The check function can be sync or async. Use explicit types in the function signature for clarity.

```typescript
// Recommended: explicit types
const isAdmin = permission('isAdmin', (ctx: AppContext) => ctx.user.role === 'admin');

// Also works: with generics
const isAdmin = permission<AppContext>('isAdmin', (ctx) => ctx.user.role === 'admin');
```

### `or(...permissions)`

Combine permissions with OR logic (any must allow). Runs checks **sequentially** and stops at the first success (short-circuit).

```typescript
const canEdit = or(isOwner, isAdmin, isModerator);
```

**Performance:** Checks run sequentially and stop at the first `true`. This is efficient when early checks are likely to succeed. For DataLoader batching, use `orParallel()` instead.

### `and(...permissions)`

Combine permissions with AND logic (all must allow). Runs checks **sequentially** and stops at the first failure (short-circuit).

```typescript
const canPublish = and(isAuthenticated, isOwner, hasVerifiedEmail);
```

**Performance:** Checks run sequentially and stop at the first `false`. This is optimal when you order cheap checks (like `isAuthenticated`) before expensive ones (like database queries).

### `orParallel(...permissions)`

Combine permissions with OR logic, running all checks in **parallel** (no short-circuit).

```typescript
const canEdit = orParallel(isOwner, isAdmin, isModerator);
```

**Use case:** When using DataLoader or similar batching, all checks run simultaneously so database queries can be batched together. Even if the first check succeeds, all other checks still execute.

### `andParallel(...permissions)`

Combine permissions with AND logic, running all checks in **parallel** (no short-circuit).

```typescript
const canPublish = andParallel(isAuthenticated, isOwner, hasVerifiedEmail);
```

**Use case:** When using DataLoader or similar batching, all checks run simultaneously so database queries can be batched together. Even if the first check fails, all other checks still execute.

### `not(permission)`

Negate a permission.

```typescript
const canComment = and(isAuthenticated, not(isBanned));
```

### `withContext(ctx, permissions)`

Bind context to specific permissions so you don't need to pass `ctx` repeatedly.

**Type signature:**

```typescript
function withContext<TContext, T extends Record<string, Permission<TContext, any>>>(
  ctx: TContext,
  permissions: T
): BoundPermissions<TContext, T>;
```

**Usage:**

```typescript
import { withContext } from 'granter';

// Bind context to permissions
const abilities = withContext(ctx, {
  isAuthenticated,
  isAdmin,
  canEditPost,
  canDeletePost,
});

// Call without ctx
if (await abilities.isAuthenticated()) {
  if (await abilities.canEditPost(post)) {
    await updatePost(post);
  }
}
```

**Benefits:**

- ✅ Pick only the permissions you need
- ✅ No need to pass `ctx` repeatedly
- ✅ Type-safe with full inference
- ✅ Perfect for Express middleware or React context
- ✅ Non-function properties are preserved

**Express middleware:**

```typescript
app.use((req, res, next) => {
  req.abilities = withContext(getContext(req), {
    isAuthenticated,
    canEditPost,
    canDeletePost,
  });
  next();
});

// Use in routes
app.put('/posts/:id', async (req, res) => {
  if (!(await req.abilities.canEditPost(post))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ...
});
```

## Error Handling

### Built-in Errors

```typescript
import { UnauthorizedError, ForbiddenError } from 'granter';

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
  error: 'You cannot delete this post',
});

// Custom error instance
await authorize(ctx, canDelete, post, {
  error: new CustomError('Denied'),
});

// Error factory
await authorize(ctx, canDelete, post, {
  error: () => new Error(`User ${ctx.user.id} cannot delete`),
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
const isOwner = permission('isOwner', async (ctx, post) => {
  const fullPost = await db.post.findUnique({ where: { id: post.id } });
  return fullPost.authorId === ctx.user.id;
});

// ✅ Batched with DataLoader
const isOwner = permission('isOwner', async (ctx, post) => {
  const fullPost = await ctx.loaders.post.load(post.id);
  return fullPost.authorId === ctx.user.id;
});
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
import { can, authorize, ForbiddenError } from 'granter';

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

- **Composable** - Build complex from simple
- **Type-safe** - TypeScript-first
- **Explicit** - No magic
- **Lightweight** - Minimal abstraction

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
