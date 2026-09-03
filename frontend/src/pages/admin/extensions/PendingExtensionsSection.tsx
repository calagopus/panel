import { faBan, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import Title from '@/elements/typography/Title.tsx';
import { AdminBackendExtension } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionCard from './ExtensionCard.tsx';
import ExtensionGrid from './ExtensionGrid.tsx';

export default function PendingExtensionsSection({
  extensionStatus,
  phase,
  isBuilding,
  buildFailed,
  cancellingBuild,
  onCancelBuild,
  onRebuild,
  onRemove,
}: {
  extensionStatus: ExtensionStatus;
  phase: string | null;
  isBuilding: boolean;
  buildFailed: boolean;
  cancellingBuild: number | null;
  onCancelBuild: () => void;
  onRebuild: (force: boolean) => void;
  onRemove: (backendExtension: AdminBackendExtension, removeMigrations: boolean) => void;
}) {
  const { t } = useTranslations();
  const { pendingExtensions, removedExtensions } = extensionStatus;

  return (
    <section className='mt-10'>
      <div className='mb-4 flex items-center justify-between border-b border-(--mantine-color-default-border) pb-3'>
        <Title order={2}>
          {t('pages.admin.extensions.section.pendingExtensions', {})}
          {pendingExtensions.length > 0 && (
            <span className='ml-2 text-xs text-(--mantine-color-dimmed)'>({pendingExtensions.length})</span>
          )}
        </Title>

        <AdminCan action='extensions.manage'>
          <Group gap='xs'>
            {phase && <span className='text-sm text-(--mantine-color-dimmed)'>{phase}</span>}

            {isBuilding && (
              <ConditionalTooltip
                enabled={cancellingBuild !== null}
                label={t('pages.admin.extensions.tooltip.cancelling', {})}
              >
                <Button
                  variant='default'
                  leftSection={<FontAwesomeIcon icon={faBan} />}
                  disabled={cancellingBuild !== null}
                  onClick={onCancelBuild}
                >
                  {t('pages.admin.extensions.button.cancelBuild', {})}
                </Button>
              </ConditionalTooltip>
            )}

            <ConditionalTooltip
              enabled={(!pendingExtensions.length && !removedExtensions.length && !buildFailed) || isBuilding}
              label={
                isBuilding
                  ? t('pages.admin.extensions.tooltip.building', {})
                  : t('pages.admin.extensions.tooltip.noPendingBuild', {})
              }
            >
              <Button
                color='red'
                leftSection={<FontAwesomeIcon icon={faRefresh} />}
                loading={isBuilding}
                onClick={() => onRebuild(buildFailed)}
              >
                {buildFailed
                  ? t('pages.admin.extensions.button.retryBuild', {})
                  : t('pages.admin.extensions.button.rebuild', {})}
              </Button>
            </ConditionalTooltip>
          </Group>
        </AdminCan>
      </div>

      {!pendingExtensions.length ? (
        <p className='text-sm text-(--mantine-color-dimmed)'>
          {t('pages.admin.extensions.section.noPendingExtensions', {})}
        </p>
      ) : (
        <ExtensionGrid>
          {pendingExtensions.map((extension) => (
            <ExtensionCard
              key={extension.metadataToml.packageName}
              backendExtension={extension}
              isPending
              onRemove={() => onRemove(extension, false)}
            />
          ))}
        </ExtensionGrid>
      )}
    </section>
  );
}
