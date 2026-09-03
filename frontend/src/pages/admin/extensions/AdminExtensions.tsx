import { faFileText, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useRef } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionInstallOverlay from './ExtensionInstallOverlay.tsx';
import ExtensionStatusAlerts from './ExtensionStatusAlerts.tsx';
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

  return (
    <AdminContentContainer
      title={t('pages.admin.extensions.title', {})}
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
        onClose={() => ext.setRemovalExtension(null)}
      />

      <ExtensionInstallOverlay visible={ext.isDragging} />

      <ExtensionStatusAlerts
        extensionStatus={ext.extensionStatus}
        supervisor={ext.supervisor}
        buildFailed={ext.buildFailed}
        failureReason={ext.failureReason}
        pendingRestart={ext.pendingRestart}
        isBuilding={ext.isBuilding}
        onRestart={ext.handleRestart}
      />

      <InstalledExtensionsGrid
        adminExtensions={ext.adminExtensions}
        extensionStatus={ext.extensionStatus}
        onRemove={ext.setRemovalExtension}
        onToggle={ext.handleToggle}
      />

      {ext.extensionStatus && (
        <PendingExtensionsSection
          extensionStatus={ext.extensionStatus}
          phase={ext.phase}
          isBuilding={ext.isBuilding}
          buildFailed={ext.buildFailed}
          cancellingBuild={ext.cancellingBuild}
          onCancelBuild={ext.handleCancelBuild}
          onRebuild={ext.handleRebuild}
          onRemove={ext.handleRemove}
        />
      )}
    </AdminContentContainer>
  );
}
