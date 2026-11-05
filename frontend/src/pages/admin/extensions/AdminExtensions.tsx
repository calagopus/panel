import { faFileText, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useRef, useState } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { computeInstalledCount } from '@/lib/extensions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionInstallOverlay from './ExtensionInstallOverlay.tsx';
import ExtensionStatusAlerts from './ExtensionStatusAlerts.tsx';
import ExtensionUploadsCard from './ExtensionUploadsCard.tsx';
import InstalledExtensionsGrid from './InstalledExtensionsGrid.tsx';
import BuildLogsModal from './modals/BuildLogsModal.tsx';
import LicenseModal from './modals/LicenseModal.tsx';
import RemoveExtensionModal from './modals/RemoveExtensionModal.tsx';
import PendingExtensionsSection from './PendingExtensionsSection.tsx';
import { useExtensionManagement } from './useExtensionManagement.ts';

export default function AdminExtensions() {
  const { t } = useTranslations();
  const ext = useExtensionManagement();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');

  const installedCount = useMemo(() => computeInstalledCount(ext.adminExtensions), [ext.adminExtensions]);

  return (
    <AdminContentContainer
      title={t('pages.admin.extensions.title', {})}
      search={search}
      setSearch={installedCount > 0 ? setSearch : undefined}
      contentRight={
        <AdminCan action='extensions.manage'>
          <Group hidden={!ext.extensionStatus} gap='xs'>
            <Button
              variant='default'
              leftSection={<FontAwesomeIcon icon={faFileText} />}
              onClick={() => ext.setOpenModal('logs')}
            >
              {t('pages.admin.extensions.button.viewBuildLogs', {})}
            </Button>
            <ConditionalTooltip enabled={ext.isBuilding} label={t('pages.admin.extensions.tooltip.building', {})}>
              <Button
                color='blue'
                leftSection={<FontAwesomeIcon icon={faUpload} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={ext.isBuilding}
              >
                {t('pages.admin.extensions.button.install', {})}
              </Button>
            </ConditionalTooltip>

            <input type='file' accept='.zip' ref={fileInputRef} className='hidden' onChange={ext.handleFileUpload} />
          </Group>
        </AdminCan>
      }
    >
      <BuildLogsModal opened={ext.openModal === 'logs'} buildId={ext.buildId} onClose={() => ext.setOpenModal(null)} />
      <LicenseModal
        opened={!!ext.pendingLicense}
        packageName={ext.pendingLicense?.extension.metadataToml.packageName}
        licenseText={ext.pendingLicense?.extension.metadataToml.licenseText ?? ''}
        onAccept={ext.handleLicenseAccept}
        onClose={() => ext.setPendingLicense(null)}
      />
      <RemoveExtensionModal
        opened={!!ext.removalExtension}
        extension={ext.removalExtension}
        onRemove={(removeMigrations) => ext.handleRemove(ext.removalExtension!, removeMigrations)}
        removing={!!ext.removalExtension && ext.isPending(`remove:${ext.removalExtension.metadataToml.packageName}`)}
        onClose={() => ext.setRemovalExtension(null)}
      />

      <ExtensionInstallOverlay visible={ext.isDragging} />

      <ExtensionStatusAlerts
        extensionStatus={ext.extensionStatus}
        supervisor={ext.supervisor}
        buildFailed={ext.buildFailed}
        failureReason={ext.failureReason}
        failedExtensions={ext.failedExtensions}
        startFailedExtensions={ext.adminExtensions?.failed ?? {}}
        pendingRestart={ext.pendingRestart}
        isBuilding={ext.isBuilding}
        onRestart={ext.handleRestart}
        restarting={ext.isPending('restart')}
      />

      <ExtensionUploadsCard uploads={ext.uploads} onCancel={ext.handleCancelUpload} />

      <InstalledExtensionsGrid
        adminExtensions={ext.adminExtensions}
        extensionStatus={ext.extensionStatus}
        failedExtensions={ext.failedExtensions}
        onRemove={ext.setRemovalExtension}
        onToggle={ext.handleToggle}
        isPending={ext.isPending}
        search={search}
      />

      {ext.extensionStatus && (
        <PendingExtensionsSection
          extensionStatus={ext.extensionStatus}
          phase={ext.phase}
          isBuilding={ext.isBuilding}
          buildFailed={ext.buildFailed}
          failedExtensions={ext.failedExtensions}
          cancellingBuild={ext.cancellingBuild}
          onCancelBuild={ext.handleCancelBuild}
          onRebuild={ext.handleRebuild}
          onRemove={ext.handleRemove}
          isPending={ext.isPending}
        />
      )}
    </AdminContentContainer>
  );
}
