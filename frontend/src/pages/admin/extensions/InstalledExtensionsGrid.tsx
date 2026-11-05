import { faCubesStacked, faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';
import { AdminExtensionList } from '@/api/admin/extensions/getAdminExtensions.ts';
import { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import {
  computeInstalledCount,
  findByPackageName,
  getBackendOnlyExtensions,
  matchesExtensionSearch,
  someByPackageName,
} from '@/lib/extensions.ts';
import { AdminBackendExtension } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionCard from './ExtensionCard.tsx';
import ExtensionGrid from './ExtensionGrid.tsx';

export default function InstalledExtensionsGrid({
  adminExtensions,
  extensionStatus,
  failedExtensions,
  onRemove,
  onToggle,
  isPending,
  search,
}: {
  adminExtensions: AdminExtensionList | undefined;
  extensionStatus: ExtensionStatus | undefined;
  failedExtensions: string[];
  onRemove: (extension: AdminBackendExtension) => void;
  onToggle: (packageName: string, enabled: boolean) => void;
  isPending: (key: string) => boolean;
  search: string;
}) {
  const { t } = useTranslations();

  const installedCount = useMemo(() => computeInstalledCount(adminExtensions), [adminExtensions]);
  const backendOnlyExtensions = useMemo(() => getBackendOnlyExtensions(adminExtensions), [adminExtensions]);

  const frontendMatches = window.extensionContext.extensions.filter((extension) =>
    matchesExtensionSearch(
      extension.packageName,
      findByPackageName(adminExtensions?.extensions ?? [], extension.packageName),
      search,
    ),
  );
  const backendOnlyMatches = backendOnlyExtensions.filter((backendExtension) =>
    matchesExtensionSearch(backendExtension.metadataToml.packageName, backendExtension, search),
  );

  const isRemoved = (packageName: string) => someByPackageName(extensionStatus?.removedExtensions ?? [], packageName);

  if (!adminExtensions) {
    return <Spinner.Centered />;
  }

  if (installedCount === 0) {
    return (
      <EmptyState
        icon={faPuzzlePiece}
        title={t('pages.admin.extensions.empty.title', {})}
        description={
          extensionStatus
            ? t('pages.admin.extensions.empty.description', {})
            : adminExtensions.managementDisabled
              ? t('pages.admin.extensions.empty.descriptionDisabled', {})
              : t('pages.admin.extensions.alert.heavyImageMissing', {
                  docsUrl: 'https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image',
                }).md()
        }
      />
    );
  }

  if (frontendMatches.length === 0 && backendOnlyMatches.length === 0) {
    return (
      <EmptyState
        icon={faCubesStacked}
        title={t('common.table.empty.title', {})}
        description={t('common.table.empty.description', {})}
      />
    );
  }

  return (
    <ExtensionGrid>
      {frontendMatches.map((extension) => {
        const backendExtension = findByPackageName(adminExtensions.extensions, extension.packageName);

        return (
          <ExtensionCard
            key={extension.packageName}
            extension={extension}
            backendExtension={backendExtension}
            isRemoved={isRemoved(extension.packageName)}
            isDisabled={backendExtension ? adminExtensions.disabled.includes(extension.packageName) : false}
            isPendingDisabled={adminExtensions.pendingDisabled.includes(extension.packageName)}
            isBuildFailed={failedExtensions.includes(extension.packageName)}
            isStartFailed={extension.packageName in adminExtensions.failed}
            onRemove={extensionStatus && backendExtension ? () => onRemove(backendExtension) : undefined}
            onToggle={backendExtension ? (enabled) => onToggle(extension.packageName, enabled) : undefined}
            busy={isPending(`toggle:${extension.packageName}`) || isPending(`remove:${extension.packageName}`)}
          />
        );
      })}
      {backendOnlyMatches.map((backendExtension) => (
        <ExtensionCard
          key={backendExtension.metadataToml.packageName}
          backendExtension={backendExtension}
          isRemoved={isRemoved(backendExtension.metadataToml.packageName)}
          isDisabled={adminExtensions.disabled.includes(backendExtension.metadataToml.packageName)}
          isPendingDisabled={adminExtensions.pendingDisabled.includes(backendExtension.metadataToml.packageName)}
          isBuildFailed={failedExtensions.includes(backendExtension.metadataToml.packageName)}
          isStartFailed={backendExtension.metadataToml.packageName in adminExtensions.failed}
          onRemove={extensionStatus ? () => onRemove(backendExtension) : undefined}
          onToggle={(enabled) => onToggle(backendExtension.metadataToml.packageName, enabled)}
          busy={
            isPending(`toggle:${backendExtension.metadataToml.packageName}`) ||
            isPending(`remove:${backendExtension.metadataToml.packageName}`)
          }
        />
      ))}
    </ExtensionGrid>
  );
}
