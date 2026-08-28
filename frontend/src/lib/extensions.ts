import { AdminExtensionList } from '@/api/admin/extensions/getAdminExtensions.ts';
import { ExtensionSupervisorState } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type TFunc = ReturnType<typeof useTranslations>['t'];

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

export function computePendingRestart(adminExtensions: AdminExtensionList | undefined): boolean {
  return adminExtensions
    ? adminExtensions.extensions.some(
        (extension) =>
          adminExtensions.disabled.includes(extension.metadataToml.packageName) !==
          adminExtensions.pendingDisabled.includes(extension.metadataToml.packageName),
      )
    : false;
}

export function computeInstalledCount(adminExtensions: AdminExtensionList | undefined): number {
  return (
    (window.extensionContext.extensions?.length || 0) +
    (adminExtensions?.extensions.filter(
      (be) => !window.extensionContext.extensions.find((e) => e.packageName === be.metadataToml.packageName),
    ).length || 0)
  );
}

export function removeByPackageName<T extends { metadataToml: { packageName: string } }>(
  list: T[],
  packageName: string,
): T[] {
  return list.filter((e) => e.metadataToml.packageName !== packageName);
}

export function upsertByPackageName<T extends { metadataToml: { packageName: string } }>(list: T[], item: T): T[] {
  return [...removeByPackageName(list, item.metadataToml.packageName), item];
}
