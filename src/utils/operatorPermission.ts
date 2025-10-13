import { permission, type Permission, type PermissionCheck } from './permission';

export function operatorPermission<TContext, TResource = undefined>(
    operator: string,
    children: Permission<TContext, TResource>[],
    check: PermissionCheck<TContext, TResource>,
  ): Permission<TContext, TResource> {
    const name = `(${children.map((p) => p.name).join(` ${operator} `)})`;
  
    return permission<TContext, TResource>(name, check, children);
  }