import { faBan, faCheck, faClone, faGripVertical, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Card from '@/elements/Card.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Group from '@/elements/Group.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import ThemeIcon from '@/elements/ThemeIcon.tsx';
import {
  serverFirewallRuleActionColorMapping,
  serverFirewallRuleActionLabelMapping,
  serverFirewallRuleProtocolLabelMapping,
} from '@/lib/enums.ts';
import { serverFirewallRuleSchema } from '@/lib/schemas/server/firewall.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Rule = z.infer<typeof serverFirewallRuleSchema>;

interface Props {
  rule: Rule;
  position: number;
  editable: boolean;
  dragHandleProps?: ComponentProps<'button'>;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export default function FirewallRuleCard({
  rule,
  position,
  editable,
  dragHandleProps,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const { t } = useTranslations();

  return (
    <ContextMenu
      items={[
        {
          type: 'action',
          icon: faPencil,
          label: t('common.button.edit', {}),
          onClick: () => onEdit?.(),
          color: 'gray',
          canAccess: editable,
        },
        {
          type: 'action',
          icon: faClone,
          label: t('common.button.duplicate', {}),
          onClick: () => onDuplicate?.(),
          color: 'gray',
          canAccess: editable,
        },
        {
          type: 'action',
          icon: faTrash,
          label: t('common.button.remove', {}),
          onClick: () => onDelete?.(),
          color: 'red',
          canAccess: editable,
        },
      ]}
      registry={window.extensionContext.extensionRegistry.pages.server.network.firewall.ruleContextMenu}
      registryProps={{ rule, position }}
    >
      {({ items, openMenu }) => (
        <Card
          onContextMenu={(e) => {
            e.preventDefault();
            openMenu(e.clientX, e.clientY);
          }}
        >
          <Group justify='space-between' align='center' wrap='nowrap' gap='xs'>
            <Group gap='sm' align='center' wrap='nowrap' className='flex-1 min-w-0'>
              {editable && (
                <ActionIcon
                  size='lg'
                  variant='subtle'
                  color='gray'
                  aria-label={t('pages.server.firewall.rule.aria.reorder', { position })}
                  className='shrink-0'
                  {...dragHandleProps}
                >
                  <FontAwesomeIcon icon={faGripVertical} />
                </ActionIcon>
              )}

              <ThemeIcon size='lg' color={serverFirewallRuleActionColorMapping[rule.action]} className='shrink-0'>
                <FontAwesomeIcon icon={rule.action === 'allow' ? faCheck : faBan} />
              </ThemeIcon>

              <Stack gap={4} className='flex-1 min-w-0'>
                <Group gap='xs' wrap='nowrap'>
                  <Badge color={serverFirewallRuleActionColorMapping[rule.action]}>
                    {serverFirewallRuleActionLabelMapping[rule.action]()}
                  </Badge>
                </Group>
                <Text size='sm' c='dimmed'>
                  {t('pages.server.firewall.rule.summary', {
                    protocols:
                      rule.protocols.length > 0
                        ? rule.protocols
                            .toSorted()
                            .map((protocol) => serverFirewallRuleProtocolLabelMapping[protocol])
                            .join(', ')
                        : t('pages.server.firewall.rule.anyProtocol', {}),
                    sources:
                      rule.sources.length > 0 ? rule.sources.join(', ') : t('pages.server.firewall.rule.anySource', {}),
                    ports: rule.ports ? rule.ports.join(', ') : t('pages.server.firewall.rule.allAllocations', {}),
                  })}
                </Text>
              </Stack>
            </Group>

            {editable && <ContextMenuToggle items={items} openMenu={openMenu} />}
          </Group>
        </Card>
      )}
    </ContextMenu>
  );
}
