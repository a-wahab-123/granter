/**
 * Example: Using permissions in an Express.js API
 */

import express from 'express';
import * as permissions from './services/permissions';
import { definePermissionsFor } from './services/permissions';
import type { AppContext, Post } from './types';

const app = express();

// Middleware to create context from request
function createContext(req: express.Request): AppContext {
  return {
    user: req.user ?? null, // Assuming auth middleware sets req.user
    db: req.app.locals.db,
  };
}

// ============================================================================
// Approach 1: Use permissions directly
// ============================================================================

app.get('/posts/:id', async (req, res) => {
  const ctx = createContext(req);
  const post = await ctx.db.posts.findUnique({ where: { id: req.params.id } });

  // Check permission directly
  if (!(await permissions.canViewPost(ctx, post))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(post);
});

app.put('/posts/:id', async (req, res) => {
  const ctx = createContext(req);
  const post = await ctx.db.posts.findUnique({ where: { id: req.params.id } });

  // Use orThrow to handle errors
  try {
    await permissions.canEditPost.orThrow(ctx, post, 'You cannot edit this post');

    const updated = await ctx.db.posts.update({
      where: { id: post.id },
      data: req.body,
    });

    res.json(updated);
  } catch (error) {
    if (error.name === 'ForbiddenError') {
      return res.status(403).json({ error: error.message });
    }
    throw error;
  }
});

// ============================================================================
// Approach 2: Use CASL-style factory pattern
// ============================================================================

app.delete('/posts/:id', async (req, res) => {
  const ctx = createContext(req);
  const abilities = definePermissionsFor(ctx);
  const post = await ctx.db.posts.findUnique({ where: { id: req.params.id } });

  // Using the factory pattern
  if (!(await abilities.canDeletePost(post))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await ctx.db.posts.delete({ where: { id: post.id } });
  res.status(204).send();
});

// ============================================================================
// Approach 3: Filter arrays
// ============================================================================

app.get('/posts', async (req, res) => {
  const ctx = createContext(req);
  const allPosts = await ctx.db.posts.findMany();

  // Filter to only posts the user can view
  const viewablePosts = await permissions.canViewPost.filter(ctx, allPosts);

  res.json(viewablePosts);
});

// ============================================================================
// Approach 4: Explain for debugging
// ============================================================================

app.get('/posts/:id/permissions', async (req, res) => {
  const ctx = createContext(req);
  const post = await ctx.db.posts.findUnique({ where: { id: req.params.id } });

  // Debug which permissions apply
  const canEdit = await permissions.canEditPost.explain(ctx, post);
  const canDelete = await permissions.canDeletePost.explain(ctx, post);

  res.json({
    canEdit: canEdit.value,
    canEditDetails: canEdit,
    canDelete: canDelete.value,
    canDeleteDetails: canDelete,
  });
});

export default app;
