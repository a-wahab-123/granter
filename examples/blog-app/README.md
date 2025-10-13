# Blog App Example

This example demonstrates how to organize permissions in a real application, inspired by CASL's centralized ability pattern.

## Project Structure

```
blog-app/
├── types.ts                          # Application types
├── services/
│   └── permissions.ts                # ALL permissions in one file
├── usage-express.ts                  # Express.js API examples
├── usage-react.tsx                   # React component examples
└── usage-bindContext.ts              # bindContext() helper examples
```

## Key Patterns

### 1. Single File - Easy to Browse

All permissions are defined in `services/permissions.ts` - one file, easy to read and understand.

```typescript
import * as permissions from './services/permissions';

// Direct usage
if (await permissions.canEditPost(ctx, post)) {
  // ...
}
```

### 2. Bind Context Helper - Pick What You Need!

Use `bindContext()` to bind context to specific permissions:

```typescript
import { bindContext, isAuthenticated, canEditPost } from './services/permissions';

// Pick only what you need
const abilities = bindContext(ctx, {
  isAuthenticated,
  canEditPost,
});

// No more ctx! Just use the abilities
if (await abilities.isAuthenticated()) {
  if (await abilities.canEditPost(post)) {
    // ...
  }
}
```

**Alternative:** Use `definePermissionsFor(ctx)` if you want all permissions included (less flexible but convenient).

### 3. Organized by Sections

The single file is organized with clear section comments for easy navigation:

- `USER & AUTHENTICATION` - Auth, roles, user state
- `POSTS` - Post-specific permissions
- `COMMENTS` - Comment-specific permissions

### 4. Composable Permissions

Build complex permissions from simple ones:

```typescript
export const canEditPost = and(isAuthenticated, not(isPostLocked), or(isPostOwner, isAdmin));
```

## Usage Examples

### Express.js API

See `usage-express.ts` for examples of:

- Direct permission checks
- Using `orThrow()` for error handling
- Filtering arrays with `filter()`
- Debugging with `explain()`

### React Components

See `usage-react.tsx` for examples of:

- Context provider pattern
- Permission-based rendering
- `<Can>` wrapper component

### bindContext() Examples

See `usage-bindContext.ts` for comprehensive examples of:

- Picking specific permissions (better tree-shaking!)
- Express middleware pattern
- React context pattern
- Multiple contexts for different users

## Benefits of This Pattern

✅ **Single source of truth** - All permissions in one file  
✅ **Easy to discover** - Browse `services/permissions.ts` to see all available permissions  
✅ **Type-safe** - Full TypeScript inference  
✅ **Testable** - Mock context to test any permission  
✅ **Flexible** - Use `bindContext()` to pick only what you need  
✅ **CASL-familiar** - Similar patterns for easy migration
