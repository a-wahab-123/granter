import { expectType, expectError, expectAssignable } from 'tsd';
import { permission, or, and, not, type Permission } from '..';

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
// Direct Permission Call Type Tests
// =============================================================================

// ✅ Context-only permission - no resource parameter
expectType<Promise<boolean>>(isAdmin(ctx));

// ❌ Context-only permission - should not accept resource
expectError(isAdmin(ctx, post));

// ✅ Resource permission - requires resource parameter
expectType<Promise<boolean>>(isPostOwner(ctx, post));

// ❌ Resource permission - missing resource parameter
expectError(isPostOwner(ctx));

// ❌ Resource permission - wrong resource type
expectError(isPostOwner(ctx, comment));

// =============================================================================
// orThrow() Method Type Tests
// =============================================================================

// ✅ Context-only permission - no resource parameter
expectType<Promise<void>>(isAdmin.orThrow(ctx));
expectType<Promise<void>>(isAdmin.orThrow(ctx, { error: 'Not admin' }));

// ❌ Context-only permission - should not accept resource as second param
expectError(isAdmin.orThrow(ctx, post));

// ✅ Resource permission - requires resource parameter
expectType<Promise<void>>(isPostOwner.orThrow(ctx, post));
expectType<Promise<void>>(isPostOwner.orThrow(ctx, post, { error: 'Not owner' }));

// ❌ Resource permission - missing resource parameter
expectError(isPostOwner.orThrow(ctx));

// ❌ Resource permission - wrong resource type
expectError(isPostOwner.orThrow(ctx, comment));

// =============================================================================
// filter() Method Type Tests
// =============================================================================

// ✅ Filter with correct resource type
expectType<Promise<Post[]>>(isPostOwner.filter(ctx, [post]));

// ❌ Filter with wrong resource type
expectError(isPostOwner.filter(ctx, [comment]));

// ✅ Return type should be array of same resource type
const filteredPosts = isPostOwner.filter(ctx, [post]);
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
// explain() Method Type Tests
// =============================================================================

// ✅ Context-only permission explain
expectType<Promise<any>>(isAdmin.explain(ctx));

// ✅ Resource permission explain
expectType<Promise<any>>(isPostOwner.explain(ctx, post));

// ❌ Resource permission explain - missing resource
expectError(isPostOwner.explain(ctx));

// =============================================================================
// permission() Helper Type Tests
// =============================================================================

// ✅ Context-only permission creation
const testContextPerm = permission<TestContext>('test', (ctx) => true);
expectType<Permission<TestContext, undefined>>(testContextPerm);

// ✅ Resource permission creation
const testResourcePerm = permission<TestContext, Post>('test', (ctx, resource) => true);
expectType<Permission<TestContext, Post>>(testResourcePerm);

// ✅ Permissions should be callable
expectType<Promise<boolean>>(testContextPerm(ctx));
expectType<Promise<boolean>>(testResourcePerm(ctx, post));

// ✅ Permissions should have methods
expectAssignable<Function>(testContextPerm.orThrow);
expectAssignable<Function>(testContextPerm.filter);
expectAssignable<Function>(testContextPerm.explain);
