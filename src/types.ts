/**
 * Explanation of a permission check
 * Used for both top-level results and nested details
 */
export type ExplanationResult = {
  name: string;
  result: boolean;
  duration: number;
  operator?: 'OR' | 'AND' | 'NOT';
  details?: ExplanationResult[];
};

/**
 * Callback for collecting explanation details
 * @internal
 */
export type ExplainCallback = (detail: ExplanationResult) => void;

/**
 * A function that checks if an action is allowed
 * Can be synchronous or asynchronous
 */
export type PermissionCheck<TContext, TResource = undefined> = (
  ctx: TContext,
  resource: TResource,
  onExplain?: ExplainCallback
) => Promise<boolean> | boolean;

/**
 * A permission with a name and check function
 */
export type Permission<TContext, TResource = undefined> = {
  name: string;
  check: PermissionCheck<TContext, TResource>;
};

export type PermissionResourceType<P> = P extends Permission<any, infer R> ? R : never;

export type ValidateSameResource<T extends any[], Expected> = T extends [infer First, ...infer Rest]
  ? First extends undefined
    ? ValidateSameResource<Rest, Expected> // Skip undefined
    : First extends Expected
      ? ValidateSameResource<Rest, Expected> // Match! Continue
      : never // Mismatch! Error
  : Expected; // All valid

export type FirstNonUndefined<T extends any[]> = T extends [infer First, ...infer Rest]
  ? First extends undefined
    ? FirstNonUndefined<Rest>
    : ValidateSameResource<Rest, First> extends never
      ? never // Validation failed
      : First // Validation passed
  : undefined;
