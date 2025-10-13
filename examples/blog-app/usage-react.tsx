/**
 * Example: Using permissions in a React application
 */

import React, { createContext, useContext, useMemo } from 'react';
import * as permissions from './services/permissions';
import { definePermissionsFor } from './services/permissions';
import type { AppContext, Post, User } from './types';

// ============================================================================
// Context provider pattern
// ============================================================================

type PermissionsContextValue = ReturnType<typeof definePermissionsFor> | null;

const PermissionsContext = createContext<PermissionsContextValue>(null);

export function PermissionsProvider({
  children,
  user,
  db,
}: {
  children: React.ReactNode;
  user: User | null;
  db: any;
}) {
  const ctx: AppContext = { user, db };
  const abilities = useMemo(() => definePermissionsFor(ctx), [user, db]);

  return <PermissionsContext.Provider value={abilities}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const abilities = useContext(PermissionsContext);
  if (!abilities) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return abilities;
}

// ============================================================================
// Usage in components
// ============================================================================

export function PostCard({ post }: { post: Post }) {
  const abilities = usePermissions();
  const [canEdit, setCanEdit] = React.useState(false);
  const [canDelete, setCanDelete] = React.useState(false);

  React.useEffect(() => {
    // Check permissions on mount
    abilities.canEditPost(post).then(setCanEdit);
    abilities.canDeletePost(post).then(setCanDelete);
  }, [post, abilities]);

  const handleEdit = async () => {
    if (await abilities.canEditPost(post)) {
      // Navigate to edit page
    }
  };

  const handleDelete = async () => {
    try {
      // Use permissions with orThrow
      await permissions.canDeletePost.orThrow(
        { user: abilities as any, db: {} } as any,
        post,
        'You cannot delete this post'
      );

      // Delete the post
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="post-card">
      <h2>{post.title}</h2>
      <p>{post.content}</p>

      <div className="actions">
        {canEdit && <button onClick={handleEdit}>Edit</button>}
        {canDelete && <button onClick={handleDelete}>Delete</button>}
      </div>
    </div>
  );
}

// ============================================================================
// Alternative: Permission-based component wrapper
// ============================================================================

export function Can({
  check,
  resource,
  children,
  fallback = null,
}: {
  check: (resource: any) => Promise<boolean>;
  resource?: any;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    check(resource).then(setAllowed);
  }, [check, resource]);

  return allowed ? <>{children}</> : <>{fallback}</>;
}

// Usage:
export function PostActions({ post }: { post: Post }) {
  const abilities = usePermissions();

  return (
    <div>
      <Can check={(p) => abilities.canEditPost(p)} resource={post}>
        <button>Edit</button>
      </Can>

      <Can check={(p) => abilities.canDeletePost(p)} resource={post}>
        <button>Delete</button>
      </Can>
    </div>
  );
}
