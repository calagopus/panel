import { useMemo } from 'react';
import { AdminExtensionList } from '@/api/admin/extensions/getAdminExtensions.ts';
import { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import Spinner from '@/elements/feedback/Spinner.tsx';
import {
  computeInstalledCount,
  findByPackageName,
  getBackendOnlyExtensions,
  someByPackageName,
} from '@/lib/extensions.ts';
import { AdminBackendExtension } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionCard from './ExtensionCard.tsx';
import ExtensionGrid from './ExtensionGrid.tsx';

export default function InstalledExtensionsGrid({
  adminExtensions,
  extensionStatus,
  onRemove,
  onToggle,
}: {
  adminExtensions: AdminExtensionList | undefined;
  extensionStatus: ExtensionStatus | undefined;
  onRemove: (extension: AdminBackendExtension) => void;
  onToggle: (packageName: string, enabled: boolean) => void;
}) {
  const { t } = useTranslations();

  const installedCount = useMemo(() => computeInstalledCount(adminExtensions), [adminExtensions]);
  const backendOnlyExtensions = useMemo(() => getBackendOnlyExtensions(adminExtensions), [adminExtensions]);

  const isRemoved = (packageName: string) => someByPackageName(extensionStatus?.removedExtensions ?? [], packageName);

  if (!adminExtensions) {
    return <Spinner.Centered />;
  }

  if (installedCount === 0) {
    return (
      <span>
        {t('pages.admin.extensions.alert.noExtensions', {})}{' '}
        {!extensionStatus && (
          <span>
            {t('pages.admin.extensions.alert.heavyImageMissing', {
              docsUrl: 'https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image',
            }).md()}
          </span>
        )}
      </span>
    );
  }

  return (
    <ExtensionGrid>
      {window.extensionContext.extensions.map((extension) => {
        const backendExtension = findByPackageName(adminExtensions.extensions, extension.packageName);

        return (
          <ExtensionCard
            key={extension.packageName}
            extension={extension}
            backendExtension={backendExtension}
            isRemoved={isRemoved(extension.packageName)}
            isDisabled={backendExtension ? adminExtensions.disabled.includes(extension.packageName) : false}
            isPendingDisabled={adminExtensions.pendingDisabled.includes(extension.packageName)}
            onRemove={extensionStatus && backendExtension ? () => onRemove(backendExtension) : undefined}
            onToggle={backendExtension ? (enabled) => onToggle(extension.packageName, enabled) : undefined}
          />
        );
      })}
      {backendOnlyExtensions.map((backendExtension) => (
        <ExtensionCard
          key={backendExtension.metadataToml.packageName}
          backendExtension={backendExtension}
          isRemoved={isRemoved(backendExtension.metadataToml.packageName)}
          isDisabled={adminExtensions.disabled.includes(backendExtension.metadataToml.packageName)}
          isPendingDisabled={adminExtensions.pendingDisabled.includes(backendExtension.metadataToml.packageName)}
          onRemove={extensionStatus ? () => onRemove(backendExtension) : undefined}
          onToggle={(enabled) => onToggle(backendExtension.metadataToml.packageName, enabled)}
        />
      ))}
    </ExtensionGrid>
  );
}
