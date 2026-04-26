import { faPuzzlePiece, faTrash, faWrench } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router';
import { Extension } from 'shared';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import Divider from '@/elements/Divider.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';

export default function ExtensionCard({
  extension,
  backendExtension,
  isPending,
  isRemoved,
  onRemove,
}: {
  extension?: Extension;
  backendExtension?: z.infer<typeof adminBackendExtensionSchema>;
  isPending?: boolean;
  isRemoved?: boolean;
  onRemove?: () => void;
}) {
  const name = backendExtension?.metadataToml.name || extension?.packageName || 'Unknown Extension';
  const packageName = backendExtension?.metadataToml.packageName || extension?.packageName;

  return (
    <Card>
      <div className='mb-3 flex items-start gap-3'>
        <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400'>
          <FontAwesomeIcon icon={faPuzzlePiece} className='text-sm' />
        </div>
        <div className='min-w-0 flex-1'>
          <h3 className='truncate text-md font-medium leading-tight text-white'>{name}</h3>
          {packageName && <p className='mt-0.5 truncate font-mono text-[11px] text-zinc-500'>{packageName}</p>}
        </div>
      </div>

      {(!extension || !backendExtension || isPending || isRemoved) && (
        <div className='mb-2.5 flex flex-wrap gap-1.5'>
          {!extension && (
            <Badge color='red' variant='light' size='sm'>
              Frontend missing
            </Badge>
          )}
          {!backendExtension && (
            <Badge color='red' variant='light' size='sm'>
              Backend missing
            </Badge>
          )}
          {isPending && (
            <Badge color='yellow' variant='light' size='sm'>
              Pending build
            </Badge>
          )}
          {isRemoved && (
            <Badge color='yellow' variant='light' size='sm'>
              Pending removal
            </Badge>
          )}
        </div>
      )}

      {backendExtension && (
        <div className='mb-3 flex flex-col gap-1.5'>
          <div className='flex items-center justify-between'>
            <span className='text-xs text-zinc-500'>Version</span>
            <span className='font-mono text-xs text-zinc-300'>{backendExtension.version}</span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-xs text-zinc-500'>Authors</span>
            <span className='truncate text-xs text-zinc-300'>{backendExtension.authors.join(', ') || 'Unknown'}</span>
          </div>
        </div>
      )}

      {backendExtension?.description && (
        <p className='flex-1 text-xs leading-relaxed text-zinc-400'>{backendExtension.description}</p>
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
          enabled={!backendExtension || !extension?.cardConfigurationPage}
          label={
            !backendExtension
              ? 'Backend extension is required to configure this extension.'
              : 'This extension does not have a configuration page defined.'
          }
          className='flex-1'
        >
          <Link to={`/admin/extensions/${extension?.packageName}`} className='block w-full'>
            <Button
              leftSection={<FontAwesomeIcon icon={faWrench} />}
              disabled={!backendExtension || !extension?.cardConfigurationPage}
              className='w-full!'
            >
              Configure
            </Button>
          </Link>
        </ConditionalTooltip>
        {backendExtension && onRemove && (
          <Tooltip label='Remove extension'>
            <ActionIcon color='red' variant='subtle' size='input-md' disabled={isRemoved} onClick={onRemove}>
              <FontAwesomeIcon icon={faTrash} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}
