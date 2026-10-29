import { faPuzzlePiece, faTrash, faWrench } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router';
import { Extension } from 'shared';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import PreviewCard from '@/elements/data-display/PreviewCard.tsx';
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
  isBuildFailed,
  isStartFailed,
  onRemove,
  onToggle,
  busy,
}: {
  extension?: Extension;
  backendExtension?: AdminBackendExtension;
  isPending?: boolean;
  isRemoved?: boolean;
  isDisabled?: boolean;
  isPendingDisabled?: boolean;
  isBuildFailed?: boolean;
  isStartFailed?: boolean;
  onRemove?: () => void;
  onToggle?: (enabled: boolean) => void;
  busy?: boolean;
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
    isBuildFailed: !!isBuildFailed,
    isStartFailed: !!isStartFailed,
  });

  const configureDisabled = !backendExtension || !!isDisabled || !!isStartFailed || !extension?.cardConfigurationPage;
  const configureButton = (
    <Button leftSection={<FontAwesomeIcon icon={faWrench} />} disabled={configureDisabled} className='w-full!'>
      {t('pages.admin.extensions.button.configure', {})}
    </Button>
  );

  const header = (
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
  );

  const badgeList = badges.length > 0 && (
    <div className='mb-2.5 flex flex-wrap gap-1.5'>
      {badges.map((badge) => (
        <Badge key={badge.key} color={badge.color} variant='light' size='sm'>
          {badge.label}
        </Badge>
      ))}
    </div>
  );

  const version = backendExtension && (
    <div className='mb-1.5 flex items-center justify-between'>
      <span className='text-xs text-(--mantine-color-dimmed)'>{t('pages.admin.extensions.card.version', {})}</span>
      <span className='font-mono text-xs text-(--mantine-color-text)'>{backendExtension.version}</span>
    </div>
  );

  const authorsLabel = (
    <span className='text-xs text-(--mantine-color-dimmed) shrink-0'>
      {t('pages.admin.extensions.card.authors', {})}
    </span>
  );
  const authors = backendExtension?.authors.join(', ') || t('common.unknown', {});

  const cardComponent = extension?.cardComponent && (
    <div>
      <extension.cardComponent />
    </div>
  );

  const actions = (
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
          <Switch
            checked={!isPendingDisabled}
            disabled={isRemoved || busy}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </Tooltip>
      )}
      {backendExtension && onRemove && (
        <Tooltip label={t('pages.admin.extensions.tooltip.removeExtension', {})}>
          <ActionIcon
            color='red'
            variant='subtle'
            size='input-md'
            disabled={isRemoved}
            loading={busy}
            onClick={onRemove}
          >
            <FontAwesomeIcon icon={faTrash} />
          </ActionIcon>
        </Tooltip>
      )}
    </div>
  );

  return (
    <PreviewCard
      preview={
        <>
          {header}
          {badgeList}
          {backendExtension && (
            <div className='mb-3'>
              {version}
              <div className='mb-1.5 flex items-start justify-between gap-2 min-w-0'>
                {authorsLabel}
                <span className='text-right text-xs text-(--mantine-color-text) min-w-0'>{authors}</span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-xs text-(--mantine-color-dimmed)'>
                  {t('pages.admin.extensions.card.panelVersion', {})}
                </span>
                <span className='font-mono text-xs text-(--mantine-color-text)'>
                  {backendExtension.metadataToml.panelVersion}
                </span>
              </div>
            </div>
          )}
          {backendExtension?.description && (
            <p className='mb-3 text-xs leading-relaxed text-(--mantine-color-dimmed)'>{backendExtension.description}</p>
          )}
          {cardComponent}
          {extension?.cardPreviewComponent && (
            <div className='mb-3'>
              <extension.cardPreviewComponent />
            </div>
          )}
          <Divider className='mb-3 mt-1' />
          {actions}
        </>
      }
    >
      {header}
      {badgeList}

      {backendExtension && (
        <div className='mb-3'>
          {version}
          <div className='flex items-center justify-between gap-2 min-w-0'>
            {authorsLabel}
            <span className='text-xs text-(--mantine-color-text) min-w-0'>
              <ScrollingText>{authors}</ScrollingText>
            </span>
          </div>
        </div>
      )}

      {backendExtension?.description && (
        <p className='flex-1 line-clamp-3 text-xs leading-relaxed text-(--mantine-color-dimmed)'>
          {backendExtension.description}
        </p>
      )}

      {cardComponent && <Divider className='mt-3 mb-1' />}
      {cardComponent}

      <Divider className='mb-3 mt-1' />

      {actions}
    </PreviewCard>
  );
}
