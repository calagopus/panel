import { faBan, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import Group from '@/elements/Group.tsx';
import Title from '@/elements/Title.tsx';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionCard from './ExtensionCard.tsx';

export interface ExtensionBuildState {
  phase: string | null;
  isBuilding: boolean;
  buildFailed: boolean;
  cancellingBuild: number | null;
}

export interface ExtensionBuildActions {
  onCancelBuild: () => void;
  onRebuild: (force: boolean) => void;
}

export default function PendingExtensionsSection({
  extensionStatus,
  buildState,
  buildActions,
  handleRemove,
}: {
  extensionStatus: ExtensionStatus;
  buildState: ExtensionBuildState;
  buildActions: ExtensionBuildActions;
  handleRemove: (backendExtension: z.infer<typeof adminBackendExtensionSchema>, removeMigrations: boolean) => void;
}) {
  const { t } = useTranslations();
  const { phase, isBuilding, buildFailed, cancellingBuild } = buildState;
  const { onCancelBuild: handleCancelBuild, onRebuild: handleRebuild } = buildActions;

  return (
    <section className='mt-10'>
      <div className='mb-4 flex items-center justify-between border-b border-zinc-700/60 pb-3'>
        <Title order={2}>
          {t('pages.admin.extensions.section.pendingExtensions', {})}
          {extensionStatus.pendingExtensions.length > 0 && (
            <span className='ml-2 text-xs text-zinc-500'>({extensionStatus.pendingExtensions.length})</span>
          )}
        </Title>

        <AdminCan action='extensions.manage'>
          <Group gap='xs'>
            {phase && <span className='text-sm text-zinc-400'>{phase}</span>}

            {isBuilding && (
              <ConditionalTooltip
                enabled={cancellingBuild !== null}
                label={t('pages.admin.extensions.tooltip.cancelling', {})}
              >
                <Button
                  variant='default'
                  leftSection={<FontAwesomeIcon icon={faBan} />}
                  disabled={cancellingBuild !== null}
                  onClick={handleCancelBuild}
                >
                  {t('pages.admin.extensions.button.cancelBuild', {})}
                </Button>
              </ConditionalTooltip>
            )}

            <ConditionalTooltip
              enabled={
                (!extensionStatus.pendingExtensions.length &&
                  !extensionStatus.removedExtensions.length &&
                  !buildFailed) ||
                isBuilding
              }
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
                onClick={() => handleRebuild(buildFailed)}
              >
                {buildFailed
                  ? t('pages.admin.extensions.button.retryBuild', {})
                  : t('pages.admin.extensions.button.rebuild', {})}
              </Button>
            </ConditionalTooltip>
          </Group>
        </AdminCan>
      </div>

      {!extensionStatus.pendingExtensions.length ? (
        <p className='text-sm text-zinc-500'>{t('pages.admin.extensions.section.noPendingExtensions', {})}</p>
      ) : (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3'>
          {extensionStatus.pendingExtensions.map((extension) => (
            <ExtensionCard
              key={extension.metadataToml.packageName}
              backendExtension={extension}
              isPending
              onRemove={extensionStatus ? () => handleRemove(extension, false) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
