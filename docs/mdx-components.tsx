import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}

// For backward compatibility
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return useMDXComponents(components);
}
