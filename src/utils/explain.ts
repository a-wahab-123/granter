import type { Permission, ExplanationResult, ExplainCallback } from '../types';
import { now } from './performance';

/**
 * Helper to execute a permission check and collect explanation details
 * @internal
 */
export async function checkWithExplain<TContext, TResource>(
  p: Permission<TContext, TResource>,
  ctx: TContext,
  resource: TResource,
  onExplain?: ExplainCallback
): Promise<{ result: boolean; detail: ExplanationResult }> {
  const start = now();
  const childDetails: ExplanationResult[] = [];

  // Collect nested details if in explain mode
  const childExplain = onExplain
    ? (detail: ExplanationResult) => childDetails.push(detail)
    : undefined;

  // Execute permission check
  const checkResult = p.check(ctx, resource, childExplain);
  const result = checkResult instanceof Promise ? await checkResult : checkResult;
  
  const duration = now() - start;

  // Build detail object
  const detail: ExplanationResult = {
    name: p.name,
    result,
    duration: Math.round(duration * 100) / 100,
    ...(childDetails.length > 0 && { details: childDetails }),
  };

  return { result, detail };
}

/**
 * Explain why a permission was allowed or denied
 * Returns detailed breakdown of all checks including nested permissions
 *
 * @example
 * ```typescript
 * const result = await explain(ctx, canEdit, post);
 * console.log(result);
 * // {
 * //   name: "(isOwner OR isAdmin)",
 * //   result: true,
 * //   duration: 5,
 * //   details: [
 * //     { name: "isOwner", result: false, duration: 2 },
 * //     { name: "isAdmin", result: true, duration: 3 }
 * //   ]
 * // }
 * ```
 */
export async function explain<TContext>(
  ctx: TContext,
  p: Permission<TContext, undefined>
): Promise<ExplanationResult>;
export async function explain<TContext, TResource>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resource: TResource
): Promise<ExplanationResult>;
export async function explain<TContext, TResource = undefined>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resource?: TResource
): Promise<ExplanationResult> {
  const details: ExplanationResult[] = [];

  const start = now();

  // Pass callback to collect explanation details
  const checkResult = p.check(ctx, resource as TResource, (detail) => {
    details.push(detail);
  });
  const allowed = checkResult instanceof Promise ? await checkResult : checkResult;

  const duration = now() - start;

  return {
    name: p.name,
    result: allowed,
    duration: Math.round(duration * 100) / 100,
    details,
  };
}
