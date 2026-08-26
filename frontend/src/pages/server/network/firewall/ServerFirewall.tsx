import { faBan, faExclamationTriangle, faPlus, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFirewall from '@/api/server/firewall/getFirewall.ts';
import updateFirewall from '@/api/server/firewall/updateFirewall.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Paper from '@/elements/Paper.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import ThemeIcon from '@/elements/ThemeIcon.tsx';
import Title from '@/elements/Title.tsx';
import { restrictToVerticalAxis } from '@/lib/dragAndDrop.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverFirewallRuleSchema } from '@/lib/schemas/server/firewall.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import NetworkSubNavigation from '../NetworkSubNavigation.tsx';
import FirewallRuleCard from './FirewallRuleCard.tsx';
import FirewallRuleModal from './modals/FirewallRuleModal.tsx';

type Rule = z.infer<typeof serverFirewallRuleSchema>;

interface DndRule extends DndItem {
  id: string;
  rule: Rule;
}

const denyAllRule: Rule = { action: 'deny', protocols: [], sources: [], ports: null };

function isCatchAll(rule: Rule): boolean {
  return rule.protocols.length === 0 && rule.sources.length === 0 && rule.ports === null;
}

function shadowedRulePositions(rules: Rule[]): number[] {
  const covers = (earlier: Rule, later: Rule): boolean => {
    if (earlier.protocols.length > 0) {
      if (later.protocols.length === 0) return false;
      if (!later.protocols.every((protocol) => earlier.protocols.includes(protocol))) return false;
    }

    if (earlier.sources.length > 0) {
      if (later.sources.length === 0) return false;
      if (!later.sources.every((source) => earlier.sources.includes(source))) return false;
    }

    if (earlier.ports !== null) {
      if (later.ports === null) return false;
      if (!later.ports.every((port) => earlier.ports!.includes(port))) return false;
    }

    return true;
  };

  return rules.flatMap((rule, index) =>
    rules.slice(0, index).some((earlier) => covers(earlier, rule)) ? [index + 1] : [],
  );
}

export default function ServerFirewall() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const canUpdate = useServerCan('firewall.update');
  const maxRuleCount = useGlobalStore((state) => state.settings.server.maxFirewallRuleCount);

  const firewall = useResource({
    queryKey: queryKeys.server(server.uuid).firewall.all(),
    queryFn: () => getFirewall(server.uuid),
  });

  const [rules, setRules] = useState<DndRule[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DndRule | null>(null);
  const [deleting, setDeleting] = useState<DndRule | null>(null);
  const [creating, setCreating] = useState(false);

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!firewall.data) return;

    setRules(firewall.data.rules.map((rule, index) => ({ id: `rule-${index}`, rule })));
    setDirty(false);
  }, [firewall.data]);

  const replace = useCallback((next: DndRule[]) => {
    setRules(next);
    setDirty(true);
  }, []);

  const doSave = async () => {
    setSaving(true);

    try {
      await updateFirewall(server.uuid, { rules: rules.map((item) => item.rule) });
      setDirty(false);
      addToast(t('pages.server.firewall.toast.saved', {}), 'success');
      firewall.invalidate();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setSaving(false);
  };

  const appendRule = (rule: Rule) => replace([...rules, { id: `rule-new-${crypto.randomUUID()}`, rule }]);

  const duplicateRule = (id: string) => {
    const index = rules.findIndex((item) => item.id === id);
    if (index === -1) return;

    replace(rules.toSpliced(index + 1, 0, { id: `rule-new-${crypto.randomUUID()}`, rule: rules[index].rule }));
  };

  const handleSaveRule = (rule: Rule) => {
    if (editing) {
      replace(rules.map((item) => (item.id === editing.id ? { ...item, rule } : item)));
    } else {
      appendRule(rule);
    }
  };

  const orderedRules = useMemo(() => rules.map((item) => item.rule), [rules]);
  const shadowed = useMemo(() => shadowedRulePositions(orderedRules), [orderedRules]);
  const defaultAllow = orderedRules.length > 0 && !orderedRules.some(isCatchAll);
  const unallocatedPorts = useMemo(() => {
    const allocated = new Set(firewall.data?.allocationPorts ?? []);
    return Array.from(new Set(orderedRules.flatMap((rule) => rule.ports ?? []))).filter((port) => !allocated.has(port));
  }, [orderedRules, firewall.data]);

  return (
    <ResourceView resource={firewall}>
      {(data) => (
        <ServerContentContainer
          title={t('pages.server.firewall.title', {})}
          subtitle={t('pages.server.firewall.subtitle', {})}
          registry={window.extensionContext.extensionRegistry.pages.server.network.firewall.container}
          contentRight={
            <ServerCan action='firewall.update'>
              <Button loading={saving} disabled={!dirty} onClick={doSave}>
                {t('common.button.save', {})}
              </Button>
            </ServerCan>
          }
        >
          <FirewallRuleModal
            opened={creating || editing !== null}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            rule={editing?.rule}
            onSave={handleSaveRule}
          />

          <ConfirmationModal
            opened={deleting !== null}
            onClose={() => setDeleting(null)}
            title={t('pages.server.firewall.modal.removeRule.title', {})}
            confirm={t('common.button.remove', {})}
            onConfirmed={() => {
              replace(rules.filter((item) => item.id !== deleting?.id));
              setDeleting(null);
            }}
          >
            {t('pages.server.firewall.modal.removeRule.content', {}).md()}
          </ConfirmationModal>

          <ConfirmationModal
            title={t('pages.server.firewall.modal.unsavedChanges.title', {})}
            opened={blocker.state === 'blocked'}
            onClose={() => blocker.reset()}
            onConfirmed={() => blocker.proceed()}
            confirm={t('common.button.leavePage', {})}
          >
            {t('pages.server.firewall.modal.unsavedChanges.content', {}).md()}
          </ConfirmationModal>

          <NetworkSubNavigation />

          <Stack>
            {data.supported === false && (
              <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                {t('pages.server.firewall.alert.notEnforced', {}).md()}
              </Alert>
            )}

            {(dirty || defaultAllow || shadowed.length > 0 || unallocatedPorts.length > 0) && (
              <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                <Stack gap='xs'>
                  {dirty && <span>{t('pages.server.firewall.alert.unsaved', {})}</span>}
                  {defaultAllow && (
                    <Group gap='sm' align='center' wrap='nowrap'>
                      <span className='flex-1'>{t('pages.server.firewall.alert.fallthrough', {}).md()}</span>
                      <ServerCan action='firewall.update'>
                        <Button
                          size='xs'
                          variant='default'
                          className='shrink-0'
                          leftSection={<FontAwesomeIcon icon={faBan} />}
                          onClick={() => appendRule(denyAllRule)}
                        >
                          {t('pages.server.firewall.button.addDenyAll', {})}
                        </Button>
                      </ServerCan>
                    </Group>
                  )}
                  {shadowed.map((position) => (
                    <span key={position}>{t('pages.server.firewall.alert.shadowed', { position })}</span>
                  ))}
                  {unallocatedPorts.length > 0 && (
                    <span>
                      {t('pages.server.firewall.alert.unallocatedPorts', {
                        ports: unallocatedPorts.join(', '),
                      }).md()}
                    </span>
                  )}
                </Stack>
              </Alert>
            )}

            <Alert color='gray'>{t('pages.server.firewall.alert.limitations', {})}</Alert>

            {rules.length === 0 ? (
              <Paper withBorder p='xl' radius='md' style={{ textAlign: 'center' }}>
                <ThemeIcon size='xl' mb='md' color='gray'>
                  <FontAwesomeIcon icon={faShieldHalved} />
                </ThemeIcon>
                <Title order={3} c='dimmed' mb='sm'>
                  {t('pages.server.firewall.empty.title', {})}
                </Title>
                <Text c='dimmed' mb='md'>
                  {canUpdate
                    ? t('pages.server.firewall.empty.description', {})
                    : t('pages.server.firewall.empty.descriptionReadOnly', {})}
                </Text>
                <ServerCan action='firewall.update'>
                  <ConditionalTooltip
                    enabled={rules.length >= maxRuleCount}
                    label={t('pages.server.firewall.tooltip.limitReached', { max: maxRuleCount })}
                  >
                    <Button
                      disabled={rules.length >= maxRuleCount}
                      onClick={() => setCreating(true)}
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                    >
                      {t('pages.server.firewall.button.createFirstRule', {})}
                    </Button>
                  </ConditionalTooltip>
                </ServerCan>
              </Paper>
            ) : (
              <DndContainer
                items={rules}
                modifiers={[restrictToVerticalAxis]}
                callbacks={{ onDragEnd: replace }}
                renderOverlay={(active) =>
                  active ? (
                    <div style={{ cursor: 'grabbing' }}>
                      <FirewallRuleCard rule={active.rule} position={1} editable />
                    </div>
                  ) : null
                }
              >
                {(items) => (
                  <Stack gap='md'>
                    {items.map((item, index) => (
                      <SortableItem
                        key={item.id}
                        id={item.id}
                        disabled={!canUpdate || creating || editing !== null || deleting !== null}
                        renderItem={({ dragHandleProps }) => (
                          <FirewallRuleCard
                            rule={item.rule}
                            position={index + 1}
                            editable={canUpdate}
                            dragHandleProps={dragHandleProps as unknown as ComponentProps<'button'>}
                            onEdit={() => setEditing(item)}
                            onDuplicate={() => duplicateRule(item.id)}
                            onDelete={() => setDeleting(item)}
                          />
                        )}
                      />
                    ))}
                  </Stack>
                )}
              </DndContainer>
            )}

            {rules.length > 0 && (
              <ServerCan action='firewall.update'>
                <Group justify='center'>
                  <ConditionalTooltip
                    enabled={rules.length >= maxRuleCount}
                    label={t('pages.server.firewall.tooltip.limitReached', { max: maxRuleCount })}
                  >
                    <Button
                      disabled={rules.length >= maxRuleCount}
                      onClick={() => setCreating(true)}
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                    >
                      {t('pages.server.firewall.button.addRule', {})}
                    </Button>
                  </ConditionalTooltip>
                </Group>
              </ServerCan>
            )}
          </Stack>
        </ServerContentContainer>
      )}
    </ResourceView>
  );
}
