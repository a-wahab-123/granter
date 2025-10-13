/**
 * Explanation of a permission check
 * Used for both top-level results and nested details
 */
export type ExplanationResult = {
  name: string;
  value: boolean;
  duration: number;
  children?: ExplanationResult[];
};

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
