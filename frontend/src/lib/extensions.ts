import type { MantineColor } from '@mantine/core';
import { AdminExtensionList } from '@/api/admin/extensions/getAdminExtensions.ts';
import { ExtensionSupervisorState } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import { AdminBackendExtension } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type TFunc = ReturnType<typeof useTranslations>['t'];

type PackageNamed = { packageName: string } | { metadataToml: { packageName: string } };

export function pkgName(entity: PackageNamed): string {
  return 'metadataToml' in entity ? entity.metadataToml.packageName : entity.packageName;
}

export function findByPackageName<T extends PackageNamed>(list: readonly T[], packageName: string): T | undefined {
  return list.find((entity) => pkgName(entity) === packageName);
}

export function someByPackageName(list: readonly PackageNamed[], packageName: string): boolean {
  return list.some((entity) => pkgName(entity) === packageName);
}

export function removeByPackageName<T extends PackageNamed>(list: T[], packageName: string): T[] {
  return list.filter((entity) => pkgName(entity) !== packageName);
}

export function upsertByPackageName<T extends PackageNamed>(list: T[], item: T): T[] {
  return [...removeByPackageName(list, pkgName(item)), item];
}

export function matchesExtensionSearch(
  packageName: string,
  backendExtension: AdminBackendExtension | undefined,
  search: string,
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  return [
    packageName,
    backendExtension?.metadataToml.name,
    backendExtension?.description,
    ...(backendExtension?.authors ?? []),
  ].some((value) => value?.toLowerCase().includes(term));
}

export function getBackendOnlyExtensions(adminExtensions: AdminExtensionList | undefined): AdminBackendExtension[] {
  const frontend = window.extensionContext.extensions;
  return (adminExtensions?.extensions ?? []).filter((be) => !someByPackageName(frontend, pkgName(be)));
}

export function getBuildPhase(t: TFunc, state: ExtensionSupervisorState): string | null {
  if (state.type === 'queued') return t('pages.admin.extensions.phase.queued', {});
  if (state.type !== 'building') return null;

  switch (state.phase.type) {
    case 'preparing':
      return t('pages.admin.extensions.phase.preparing', {});
    case 'clearing':
      return t('pages.admin.extensions.phase.clearing', {});
    case 'adding':
      return t('pages.admin.extensions.phase.adding', { done: state.phase.done, total: state.phase.total });
    case 'resync':
      return t('pages.admin.extensions.phase.resync', {});
    case 'staging_translations':
      return t('pages.admin.extensions.phase.stagingTranslations', {});
    case 'building':
      return t('pages.admin.extensions.phase.compiling', {});
    case 'verifying':
      return t('pages.admin.extensions.phase.verifying', {});
    case 'installing':
      return t('pages.admin.extensions.phase.installing', {});
    case 'restarting':
      return t('pages.admin.extensions.phase.restarting', {});
  }
}

export function isPendingRestart(disabled: boolean, pendingDisabled: boolean): boolean {
  return disabled !== pendingDisabled;
}

export function computePendingRestart(adminExtensions: AdminExtensionList | undefined): boolean {
  if (!adminExtensions) return false;

  return adminExtensions.extensions.some((extension) =>
    isPendingRestart(
      adminExtensions.disabled.includes(extension.metadataToml.packageName),
      adminExtensions.pendingDisabled.includes(extension.metadataToml.packageName),
    ),
  );
}

export function computeInstalledCount(adminExtensions: AdminExtensionList | undefined): number {
  return window.extensionContext.extensions.length + getBackendOnlyExtensions(adminExtensions).length;
}

export interface ExtensionCardFlags {
  hasFrontend: boolean;
  hasBackend: boolean;
  isPendingBuild: boolean;
  isPendingRemoval: boolean;
  isDisabled: boolean;
  isPendingDisabled: boolean;
  isBuildFailed: boolean;
  isStartFailed: boolean;
}

export interface ExtensionBadge {
  key: string;
  color: MantineColor;
  label: string;
}

export function getExtensionBadges(t: TFunc, flags: ExtensionCardFlags): ExtensionBadge[] {
  const badges: ExtensionBadge[] = [];

  if (flags.isBuildFailed) {
    badges.push({ key: 'buildFailed', color: 'red', label: t('pages.admin.extensions.badge.buildFailed', {}) });
  }
  if (flags.isStartFailed) {
    badges.push({ key: 'startFailed', color: 'red', label: t('pages.admin.extensions.badge.startFailed', {}) });
  }
  if (flags.isDisabled) {
    badges.push({ key: 'disabled', color: 'gray', label: t('pages.admin.extensions.badge.disabled', {}) });
  }
  if (isPendingRestart(flags.isDisabled, flags.isPendingDisabled)) {
    badges.push({
      key: 'pendingRestart',
      color: 'yellow',
      label: t('pages.admin.extensions.badge.pendingRestart', {}),
    });
  }
  if (!flags.hasFrontend && !flags.isDisabled && !flags.isStartFailed) {
    badges.push({
      key: 'frontendMissing',
      color: 'red',
      label: t('pages.admin.extensions.badge.frontendMissing', {}),
    });
  }
  if (!flags.hasBackend) {
    badges.push({ key: 'backendMissing', color: 'red', label: t('pages.admin.extensions.badge.backendMissing', {}) });
  }
  if (flags.isPendingBuild) {
    badges.push({ key: 'pendingBuild', color: 'yellow', label: t('pages.admin.extensions.badge.pendingBuild', {}) });
  }
  if (flags.isPendingRemoval) {
    badges.push({
      key: 'pendingRemoval',
      color: 'yellow',
      label: t('pages.admin.extensions.badge.pendingRemoval', {}),
    });
  }

  return badges;
}
