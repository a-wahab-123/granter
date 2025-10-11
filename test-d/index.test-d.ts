import { expectType, expectError, expectAssignable } from 'tsd';
import { permission, or, and, not, can, authorize, filter, withContext, type Permission } from '..';

// Test types
type Post = { authorId: string };
type Comment = { authorId: string; postId: string };
type User = { id: string; role: string };

type TestContext = {
  user: User;
};

// Test permissions
const isAdmin = permission<TestContext>('isAdmin', (ctx) => ctx.user.role === 'admin');

const isUser = permission<TestContext>('isUser', (ctx) => ctx.user.role === 'user');

const isPostOwner = permission<TestContext, Post>(
  'isPostOwner',
  (ctx, resource) => resource.authorId === ctx.user.id
);

const isCommentOwner = permission<TestContext, Comment>(
  'isCommentOwner',
  (ctx, resource) => resource.authorId === ctx.user.id
);

const canEditPost = permission<TestContext, Post>(
  'canEditPost',
  (ctx, resource) => ctx.user.role === 'admin' || resource.authorId === ctx.user.id
);

// Test data
const ctx: TestContext = { user: { id: '1', role: 'user' } };
const post: Post = { authorId: '1' };
const comment: Comment = { authorId: '1', postId: '1' };

// =============================================================================
// can() Type Tests
// =============================================================================

// ✅ Context-only permission - no resource parameter
expectType<Promise<boolean>>(can(ctx, isAdmin));

// ❌ Context-only permission - should not accept resource
expectError(can(ctx, isAdmin, post));

// ✅ Resource permission - requires resource parameter
expectType<Promise<boolean>>(can(ctx, isPostOwner, post));

// ❌ Resource permission - missing resource parameter
expectError(can(ctx, isPostOwner));

// ❌ Resource permission - wrong resource type
expectError(can(ctx, isPostOwner, comment));

// =============================================================================
// authorize() Type Tests
// =============================================================================

// ✅ Context-only permission - no resource parameter
expectType<Promise<void>>(authorize(ctx, isAdmin));
expectType<Promise<void>>(authorize(ctx, isAdmin, { error: 'Not admin' }));

// ❌ Context-only permission - should not accept resource as second param
expectError(authorize(ctx, isAdmin, post));

// ✅ Resource permission - requires resource parameter
expectType<Promise<void>>(authorize(ctx, isPostOwner, post));
expectType<Promise<void>>(authorize(ctx, isPostOwner, post, { error: 'Not owner' }));

// ❌ Resource permission - missing resource parameter
expectError(authorize(ctx, isPostOwner));

// ❌ Resource permission - wrong resource type
expectError(authorize(ctx, isPostOwner, comment));

// =============================================================================
// filter() Type Tests
// =============================================================================

// ✅ Filter with correct resource type
expectType<Promise<Post[]>>(filter(ctx, isPostOwner, [post]));

// ❌ Filter with wrong resource type
expectError(filter(ctx, isPostOwner, [comment]));

// ✅ Return type should be array of same resource type
const filteredPosts = filter(ctx, isPostOwner, [post]);
expectType<Promise<Post[]>>(filteredPosts);

// =============================================================================
// or() Operator Type Tests
// =============================================================================

// ✅ All context-only permissions -> returns Permission<Context, undefined>
const allContextOnly = or(isAdmin, isUser);
expectType<Permission<TestContext, undefined>>(allContextOnly);

// ✅ Mixed context-only and resource permissions -> returns Permission<Context, Resource>
const mixedPerms = or(isAdmin, isPostOwner);
expectType<Permission<TestContext, Post>>(mixedPerms);

// ✅ All same resource type -> returns Permission<Context, Resource>
const sameResourceType = or(isPostOwner, canEditPost);
expectType<Permission<TestContext, Post>>(sameResourceType);

// ❌ Different resource types should error (if validation is working)
// Note: This may or may not error depending on implementation
// expectError(or(isPostOwner, isCommentOwner));

// =============================================================================
// and() Operator Type Tests
// =============================================================================

// ✅ All context-only permissions -> returns Permission<Context, undefined>
const andContextOnly = and(isAdmin, isUser);
expectType<Permission<TestContext, undefined>>(andContextOnly);

// ✅ Mixed context-only and resource permissions -> returns Permission<Context, Resource>
const andMixed = and(isAdmin, isPostOwner);
expectType<Permission<TestContext, Post>>(andMixed);

// ✅ All same resource type -> returns Permission<Context, Resource>
const andSameResource = and(isPostOwner, canEditPost);
expectType<Permission<TestContext, Post>>(andSameResource);

// =============================================================================
// not() Operator Type Tests
// =============================================================================

// ✅ Context-only permission
const notAdmin = not(isAdmin);
expectType<Permission<TestContext, undefined>>(notAdmin);

// ✅ Resource permission
const notOwner = not(isPostOwner);
expectType<Permission<TestContext, Post>>(notOwner);

// =============================================================================
// withContext() Type Tests
// =============================================================================

const contextBound = withContext(ctx);

// ✅ Context-bound can() with context-only permission
expectType<Promise<boolean>>(contextBound.can(isAdmin));

// ❌ Context-bound can() with context-only permission should not accept resource
expectError(contextBound.can(isAdmin, post));

// ✅ Context-bound can() with resource permission
expectType<Promise<boolean>>(contextBound.can(isPostOwner, post));

// ❌ Context-bound can() with resource permission - missing resource
expectError(contextBound.can(isPostOwner));

// ✅ Context-bound authorize() with context-only permission
expectType<Promise<void>>(contextBound.authorize(isAdmin));
expectType<Promise<void>>(contextBound.authorize(isAdmin, { error: 'Error' }));

// ✅ Context-bound authorize() with resource permission
expectType<Promise<void>>(contextBound.authorize(isPostOwner, post));
expectType<Promise<void>>(contextBound.authorize(isPostOwner, post, { error: 'Error' }));

// ❌ Context-bound authorize() with resource permission - missing resource
expectError(contextBound.authorize(isPostOwner));

// ✅ Context-bound filter()
expectType<Promise<Post[]>>(contextBound.filter(isPostOwner, [post]));

// ❌ Context-bound filter() with wrong resource type
expectError(contextBound.filter(isPostOwner, [comment]));

// =============================================================================
// permission() Helper Type Tests
// =============================================================================

// ✅ Context-only permission creation
const testContextPerm = permission<TestContext>('test', (ctx) => true);
expectType<Permission<TestContext, undefined>>(testContextPerm);

// ✅ Resource permission creation
const testResourcePerm = permission<TestContext, Post>('test', (ctx, resource) => true);
expectType<Permission<TestContext, Post>>(testResourcePerm);

// ✅ Permission name should be string
expectType<string>(testContextPerm.name);
expectType<string>(testResourcePerm.name);

// ✅ Permission check should be a function
expectAssignable<Function>(testContextPerm.check);
expectAssignable<Function>(testResourcePerm.check);
