import { z } from 'zod';
import { permissionMapSchema } from '@/lib/schemas/generic.ts';

export interface PermissionSets {
  userPermissions: string[];
  serverPermissions: string[];
  adminPermissions: string[];
}

function parsePermissionParam(
  searchParams: URLSearchParams,
  param: string,
  available: z.infer<typeof permissionMapSchema>,
): string[] {
  const availableKeys = new Set(
    Object.entries(available).flatMap(([category, { permissions: perms }]) =>
      Object.keys(perms).map((perm) => `${category}.${perm}`),
    ),
  );

  return Array.from(
    new Set(
      (searchParams.get(param)?.split(',') ?? []).map((perm) => perm.trim()).filter((perm) => availableKeys.has(perm)),
    ),
  ).sort();
}

export function parseRequestedPermissions(
  searchParams: URLSearchParams,
  availablePermissions: {
    userPermissions: z.infer<typeof permissionMapSchema>;
    serverPermissions: z.infer<typeof permissionMapSchema>;
    adminPermissions: z.infer<typeof permissionMapSchema>;
  },
  isAdmin: boolean,
): PermissionSets {
  return {
    userPermissions: parsePermissionParam(searchParams, 'user_permissions', availablePermissions.userPermissions),
    serverPermissions: parsePermissionParam(searchParams, 'server_permissions', availablePermissions.serverPermissions),
    adminPermissions: isAdmin
      ? parsePermissionParam(searchParams, 'admin_permissions', availablePermissions.adminPermissions)
      : [],
  };
}

export function getDroppedPermissions(searchParams: URLSearchParams, accepted: PermissionSets): string[] {
  const kept = new Set([...accepted.userPermissions, ...accepted.serverPermissions, ...accepted.adminPermissions]);

  return Array.from(
    new Set(
      ['user_permissions', 'server_permissions', 'admin_permissions'].flatMap((param) =>
        (searchParams.get(param)?.split(',') ?? [])
          .map((perm) => perm.trim())
          .filter((perm) => perm && !kept.has(perm)),
      ),
    ),
  ).sort();
}

export function parseCallbackUrl(searchParams: URLSearchParams): URL | null {
  const raw = searchParams.get('callback_url');
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    return null;
  }
}
