import { faArrowUpRightFromSquare, faEllipsis, faPlug, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ContextMenu, { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import Text from '@/elements/typography/Text.tsx';
import { networkProtocolLabelMapping } from '@/lib/enums.ts';
import { networkProtocol } from '@/lib/schemas/generic.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type TunnelNodePort = { port: number; protocols: z.infer<typeof networkProtocol>[] };

type Props = {
  measureRef: Ref<HTMLDivElement>;
  title: string;
  addresses: string[];
  caption?: string;
  ports: TunnelNodePort[];
  portsEmpty?: string;
  self?: boolean;
  href?: string;
  items?: ContextMenuItem[];
};

export default function TunnelNode({
  measureRef,
  title,
  addresses,
  caption,
  ports,
  portsEmpty,
  self = false,
  href,
  items = [],
}: Props) {
  const { t } = useTranslations();

  return (
    <ContextMenu items={items}>
      {({ items: resolved, openMenu }) => (
        <div ref={measureRef}>
          <Card
            withBorder
            className={self ? 'border-(--mantine-primary-color-filled)! shadow-md' : undefined}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openMenu(event.clientX, event.clientY);
            }}
          >
            <Stack gap='xs'>
              <Group justify='space-between' align='center' wrap='nowrap' gap='xs'>
                <Group gap='xs' align='center' wrap='nowrap' className='min-w-0 flex-1'>
                  <ThemeIcon size='md' color={self ? undefined : 'gray'} className='shrink-0'>
                    <FontAwesomeIcon icon={self ? faServer : faPlug} />
                  </ThemeIcon>
                  {href ? (
                    <NavLink to={href} className='min-w-0 truncate font-medium hover:underline'>
                      {title}
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='ml-1.5 opacity-60' size='xs' />
                    </NavLink>
                  ) : (
                    <Text fw={500} className='min-w-0 truncate'>
                      {title}
                    </Text>
                  )}
                </Group>

                {resolved.some((item) => item.type === 'action' && !item.hidden && item.canAccess !== false) && (
                  <ActionIcon
                    size='sm'
                    variant='subtle'
                    color='gray'
                    aria-label={t('pages.server.tunnel.node.actions', {})}
                    onClick={(event) => {
                      event.stopPropagation();
                      openMenu(event.clientX, event.clientY);
                    }}
                  >
                    <FontAwesomeIcon icon={faEllipsis} />
                  </ActionIcon>
                )}
              </Group>

              {addresses.length > 0 && (
                <Stack gap={2}>
                  {caption && (
                    <Text size='xs' c='dimmed'>
                      {caption}
                    </Text>
                  )}
                  <Group gap={4}>
                    {addresses.map((address) => (
                      <CopyOnClick key={address} content={address}>
                        <Badge variant='default' tt='none'>
                          {address}
                        </Badge>
                      </CopyOnClick>
                    ))}
                  </Group>
                </Stack>
              )}

              {ports.length === 0 ? (
                <Text size='xs' c='dimmed'>
                  {portsEmpty ??
                    (self ? t('pages.server.tunnel.node.noPortsSelf', {}) : t('pages.server.tunnel.node.noPorts', {}))}
                </Text>
              ) : (
                <Group gap={4}>
                  {ports.map((port) => (
                    <Badge key={port.port} variant='light' size='sm' tt='none'>
                      {port.port}/
                      {port.protocols
                        .toSorted()
                        .map((protocol) => networkProtocolLabelMapping[protocol])
                        .join('+')}
                    </Badge>
                  ))}
                </Group>
              )}
            </Stack>
          </Card>
        </div>
      )}
    </ContextMenu>
  );
}
