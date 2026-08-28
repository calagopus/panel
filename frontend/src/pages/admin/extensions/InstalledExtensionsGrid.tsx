import { useMemo } from 'react';
import { z } from 'zod';
import { AdminExtensionList } from '@/api/admin/extensions/getAdminExtensions.ts';
import { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import Spinner from '@/elements/Spinner.tsx';
import { computeInstalledCount } from '@/lib/extensions.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionCard from './ExtensionCard.tsx';

export default function InstalledExtensionsGrid({
  adminExtensions,
  extensionStatus,
  setRemovalExtension,
  handleToggle,
}: {
  adminExtensions: AdminExtensionList | undefined;
  extensionStatus: ExtensionStatus | undefined;
  setRemovalExtension: (extension: z.infer<typeof adminBackendExtensionSchema>) => void;
  handleToggle: (packageName: string, enabled: boolean) => void;
}) {
  const { t } = useTranslations();
  const installedCount = useMemo(() => computeInstalledCount(adminExtensions), [adminExtensions]);

  const backendOnlyExtensions = useMemo(
    () =>
      (adminExtensions?.extensions ?? []).filter(
        (be) => !window.extensionContext.extensions.find((e) => e.packageName === be.metadataToml.packageName),
      ),
    [adminExtensions],
  );

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
    <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3'>
      {window.extensionContext.extensions.map((extension) => {
        const backendExtension = adminExtensions.extensions.find(
          (e) => e.metadataToml.packageName === extension.packageName,
        );

        return (
          <ExtensionCard
            key={extension.packageName}
            extension={extension}
            backendExtension={backendExtension}
            isRemoved={extensionStatus?.removedExtensions.some(
              (e) => e.metadataToml.packageName === extension.packageName,
            )}
            isDisabled={false}
            isPendingDisabled={adminExtensions.pendingDisabled.includes(extension.packageName)}
            onRemove={extensionStatus && backendExtension ? () => setRemovalExtension(backendExtension) : undefined}
            onToggle={backendExtension ? (enabled) => handleToggle(extension.packageName, enabled) : undefined}
          />
        );
      })}
      {backendOnlyExtensions.map((backendExtension) => (
        <ExtensionCard
          key={backendExtension.metadataToml.packageName}
          backendExtension={backendExtension}
          isRemoved={extensionStatus?.removedExtensions.some(
            (e) => e.metadataToml.packageName === backendExtension.metadataToml.packageName,
          )}
          isDisabled={adminExtensions.disabled.includes(backendExtension.metadataToml.packageName)}
          isPendingDisabled={adminExtensions.pendingDisabled.includes(backendExtension.metadataToml.packageName)}
          onRemove={extensionStatus ? () => setRemovalExtension(backendExtension) : undefined}
          onToggle={(enabled) => handleToggle(backendExtension.metadataToml.packageName, enabled)}
        />
      ))}
    </div>
  );
}
