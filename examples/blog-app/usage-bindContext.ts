/**
 * Example: Using bindContext() helper - the flexible way!
 */

import { bindContext, isAuthenticated, isAdmin, canEditPost, canDeletePost, canViewPost } from './services/permissions';
import type { AppContext } from './types';

// ============================================================================
// Example 1: Pick only what you need
// ============================================================================

async function example1() {
  const ctx: AppContext = {
    user: { id: '1', role: 'admin', email: 'admin@example.com', isVerified: true, isBanned: false },
    db: null as any,
  };

  // Bind only the permissions you need for this use case
  const abilities = bindContext(ctx, {
    isAuthenticated,
    isAdmin,
    canEditPost,
  });

  // Use without passing ctx every time!
  if (await abilities.isAuthenticated()) {
    console.log('User is authenticated');
  }

  if (await abilities.isAdmin()) {
    console.log('User is admin');
  }

  const post = { id: '1', authorId: '1', title: 'Hello', content: 'World', published: true, locked: false };

  if (await abilities.canEditPost(post)) {
    console.log('Can edit post');
  }
}

// ============================================================================
// Example 2: Express.js middleware pattern
// ============================================================================

import express from 'express';

const app = express();

// Middleware to add bound abilities to request
app.use((req: any, res, next) => {
  const ctx: AppContext = {
    user: req.user ?? null,
    db: req.app.locals.db,
  };

  // Bind all permissions you'll need in your routes
  req.abilities = bindContext(ctx, {
    isAuthenticated,
    isAdmin,
    canViewPost,
    canEditPost,
    canDeletePost,
  });

  next();
});

// Now use in routes without ctx!
app.get('/posts/:id', async (req: any, res) => {
  const post = await req.abilities.db.posts.findUnique({ where: { id: req.params.id } });

  // Clean! No ctx needed
  if (!(await req.abilities.canViewPost(post))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(post);
});

app.delete('/posts/:id', async (req: any, res) => {
  const post = await req.abilities.db.posts.findUnique({ where: { id: req.params.id } });

  // Beautiful!
  if (!(await req.abilities.canDeletePost(post))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await req.abilities.db.posts.delete({ where: { id: post.id } });
  res.status(204).send();
});

// ============================================================================
// Example 3: React Context pattern
// ============================================================================

import React, { createContext, useContext, useMemo } from 'react';

type AbilitiesContextValue = ReturnType<typeof bindContext<AppContext, any>> | null;

const AbilitiesContext = createContext<AbilitiesContextValue>(null);

export function AbilitiesProvider({ children, user, db }: any) {
  const ctx: AppContext = { user, db };

  // Bind all permissions you need in your app
  const abilities = useMemo(
    () =>
      bindContext(ctx, {
        isAuthenticated,
        isAdmin,
        canViewPost,
        canEditPost,
        canDeletePost,
      }),
    [user, db]
  );

  return <AbilitiesContext.Provider value={abilities}>{children}</AbilitiesContext.Provider>;
}

export function useAbilities() {
  const abilities = useContext(AbilitiesContext);
  if (!abilities) {
    throw new Error('useAbilities must be used within AbilitiesProvider');
  }
  return abilities;
}

// Usage in components
export function PostCard({ post }: any) {
  const abilities = useAbilities();
  const [canEdit, setCanEdit] = React.useState(false);

  React.useEffect(() => {
    // No ctx needed!
    abilities.canEditPost(post).then(setCanEdit);
  }, [post, abilities]);

  return (
    <div>
      <h2>{post.title}</h2>
      {canEdit && <button>Edit</button>}
    </div>
  );
}

// ============================================================================
// Example 4: Different abilities for different contexts
// ============================================================================

async function example4() {
  const adminCtx: AppContext = {
    user: { id: '1', role: 'admin', email: 'admin@example.com', isVerified: true, isBanned: false },
    db: null as any,
  };

  const userCtx: AppContext = {
    user: { id: '2', role: 'user', email: 'user@example.com', isVerified: true, isBanned: false },
    db: null as any,
  };

  // Different abilities for different users
  const adminAbilities = bindContext(adminCtx, {
    isAdmin,
    canDeletePost,
  });

  const userAbilities = bindContext(userCtx, {
    isAdmin,
    canEditPost,
  });

  console.log(await adminAbilities.isAdmin()); // true
  console.log(await userAbilities.isAdmin()); // false

  const post = { id: '1', authorId: '2', title: 'Hello', content: 'World', published: true, locked: false };

  console.log(await adminAbilities.canDeletePost(post)); // true (admin can delete anything)
  console.log(await userAbilities.canEditPost(post)); // true (owner can edit their post)
}

// ============================================================================
// Comparison with definePermissionsFor
// ============================================================================

async function comparison() {
  const ctx: AppContext = {
    user: { id: '1', role: 'admin', email: 'admin@example.com', isVerified: true, isBanned: false },
    db: null as any,
  };

  // Option 1: definePermissionsFor - all permissions included
  // Good when you need most/all permissions
  const allAbilities = definePermissionsFor(ctx);
  await allAbilities.canEditPost({ id: '1', authorId: '1', title: '', content: '', published: true, locked: false });
  await allAbilities.isAuthenticated();
  // ... all permissions available

  // Option 2: bindContext - pick what you need
  // Good when you only need specific permissions (better tree-shaking, clearer intent)
  const specificAbilities = bindContext(ctx, {
    canEditPost,
    isAuthenticated,
  });
  await specificAbilities.canEditPost({ id: '1', authorId: '1', title: '', content: '', published: true, locked: false });
  await specificAbilities.isAuthenticated();
  // Only these 2 available - more explicit!
}

export default { example1, example4, comparison };

