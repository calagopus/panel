import { faPuzzlePiece, faTrash, faWrench } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router';
import { Extension } from 'shared';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import { getExtensionBadges } from '@/lib/extensions.ts';
import { AdminBackendExtension } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ExtensionCard({
  extension,
  backendExtension,
  isPending,
  isRemoved,
  isDisabled,
  isPendingDisabled,
  onRemove,
  onToggle,
}: {
  extension?: Extension;
  backendExtension?: AdminBackendExtension;
  isPending?: boolean;
  isRemoved?: boolean;
  isDisabled?: boolean;
  isPendingDisabled?: boolean;
  onRemove?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const { t } = useTranslations();

  const name =
    backendExtension?.metadataToml.name || extension?.packageName || t('pages.admin.extensions.unknownExtension', {});
  const packageName = backendExtension?.metadataToml.packageName || extension?.packageName;

  const badges = getExtensionBadges(t, {
    hasFrontend: !!extension,
    hasBackend: !!backendExtension,
    isPendingBuild: !!isPending,
    isPendingRemoval: !!isRemoved,
    isDisabled: !!isDisabled,
    isPendingDisabled: !!isPendingDisabled,
  });

  const configureDisabled = !backendExtension || !!isDisabled || !extension?.cardConfigurationPage;
  const configureButton = (
    <Button leftSection={<FontAwesomeIcon icon={faWrench} />} disabled={configureDisabled} className='w-full!'>
      {t('pages.admin.extensions.button.configure', {})}
    </Button>
  );

  return (
    <Card>
      <div className='mb-3 flex items-start gap-3'>
        <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--mantine-color-default-hover) text-(--mantine-color-dimmed)'>
          {extension?.cardIcon ?? <FontAwesomeIcon icon={faPuzzlePiece} className='text-sm' />}
        </div>
        <div className='min-w-0 flex-1'>
          <h3 className='text-md font-medium leading-tight'>
            <ScrollingText>{name}</ScrollingText>
          </h3>
          {packageName && (
            <p className='mt-0.5 font-mono text-[11px] text-(--mantine-color-dimmed)'>
              <ScrollingText>{packageName}</ScrollingText>
            </p>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <div className='mb-2.5 flex flex-wrap gap-1.5'>
          {badges.map((badge) => (
            <Badge key={badge.key} color={badge.color} variant='light' size='sm'>
              {badge.label}
            </Badge>
          ))}
        </div>
      )}

      {backendExtension && (
        <div className='mb-3 flex flex-col gap-1.5'>
          <div className='flex items-center justify-between'>
            <span className='text-xs text-(--mantine-color-dimmed)'>
              {t('pages.admin.extensions.card.version', {})}
            </span>
            <span className='font-mono text-xs text-(--mantine-color-text)'>{backendExtension.version}</span>
          </div>
          <div className='flex items-center justify-between gap-2 min-w-0'>
            <span className='text-xs text-(--mantine-color-dimmed) shrink-0'>
              {t('pages.admin.extensions.card.authors', {})}
            </span>
            <span className='text-xs text-(--mantine-color-text) min-w-0'>
              <ScrollingText>{backendExtension.authors.join(', ') || t('common.unknown', {})}</ScrollingText>
            </span>
          </div>
        </div>
      )}

      {backendExtension?.description && (
        <p className='flex-1 text-xs leading-relaxed text-(--mantine-color-dimmed)'>{backendExtension.description}</p>
      )}

      {extension?.cardComponent && (
        <div>
          <Divider className='mt-3 mb-1' />

          <extension.cardComponent />
        </div>
      )}

      <Divider className='mb-3 mt-1' />

      <div className='mt-auto flex items-center gap-2'>
        <ConditionalTooltip
          enabled={configureDisabled}
          label={
            !backendExtension
              ? t('pages.admin.extensions.tooltip.noBackend', {})
              : isDisabled
                ? t('pages.admin.extensions.tooltip.extensionDisabled', {})
                : t('pages.admin.extensions.tooltip.noConfigurationPage', {})
          }
          className='flex-1'
        >
          {configureDisabled || !extension ? (
            configureButton
          ) : (
            <Link to={`/admin/extensions/${extension.packageName}`} className='block w-full'>
              {configureButton}
            </Link>
          )}
        </ConditionalTooltip>
        {backendExtension && onToggle && (
          <Tooltip
            label={
              isPendingDisabled
                ? t('pages.admin.extensions.tooltip.enableExtension', {})
                : t('pages.admin.extensions.tooltip.disableExtension', {})
            }
          >
            <Switch checked={!isPendingDisabled} disabled={isRemoved} onChange={(e) => onToggle(e.target.checked)} />
          </Tooltip>
        )}
        {backendExtension && onRemove && (
          <Tooltip label={t('pages.admin.extensions.tooltip.removeExtension', {})}>
            <ActionIcon color='red' variant='subtle' size='input-md' disabled={isRemoved} onClick={onRemove}>
              <FontAwesomeIcon icon={faTrash} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}
