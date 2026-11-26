import { faBook, faCheck, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Combobox, ModalProps, useCombobox, useModalsStack } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getAllEggRepositoryEggs from '@/api/admin/egg-repositories/eggs/getAllEggRepositoryEggs.ts';
import installEgg from '@/api/admin/egg-repositories/eggs/installEgg.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import NestSelect from '@/elements/input/NestSelect.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Kbd from '@/elements/typography/Kbd.tsx';
import Text from '@/elements/typography/Text.tsx';
import { isInstalledEggUpdateAvailable } from '@/lib/domain/egg.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryCatalogEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import NestCreateModal from '@/pages/admin/nests/modals/NestCreateModal.tsx';
import { NestCreateHint } from '@/pages/admin/nests/NestCreateField.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryEggDrawer from '../drawers/EggRepositoryEggDrawer.tsx';

type CatalogEgg = z.infer<typeof adminEggRepositoryCatalogEggSchema>;
type Nest = z.infer<typeof adminNestSchema>;

export interface EggRepositoryCatalogInstallResult {
  egg: z.infer<typeof adminEggSchema>;
  nest: Nest;
  created: boolean;
}

export default function EggRepositoryCatalogModal({
  nest,
  confirmLabel,
  onInstalled,
  ...props
}: ModalProps & {
  nest?: Nest;
  confirmLabel?: string;
  onInstalled?: (result: EggRepositoryCatalogInstallResult) => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const stack = useModalsStack(['catalog', 'nest']);
  const combobox = useCombobox();

  const [selected, setSelected] = useState<CatalogEgg | null>(null);
  const [chosenNest, setChosenNest] = useState<Nest | null>(null);
  const [createdNests, setCreatedNests] = useState<Nest[]>([]);
  const [installing, setInstalling] = useState(false);
  const [readmeOpen, setReadmeOpen] = useState(false);

  const { data, loading, error, search, debouncedSearch, setSearch } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggRepositories.eggsUnscoped(),
    fetcher: (page, search) => getAllEggRepositoryEggs(page, search),
    modifyParams: false,
    canRequest: props.opened,
  });

  const items = data?.data ?? [];

  useEffect(() => {
    if (props.opened) {
      stack.open('catalog');
      combobox.openDropdown();
    } else {
      stack.closeAll();
      setSelected(null);
      setChosenNest(null);
      setReadmeOpen(false);
      setSearch('');
    }
  }, [props.opened]);

  useEffect(() => {
    if (props.opened) combobox.selectFirstOption();
  }, [props.opened, items.map((item) => item.egg.uuid).join('|')]);

  const defaultNest = selected?.egg.eggRepository.defaultNest ?? null;
  const targetNest = nest ?? chosenNest ?? defaultNest;
  const isEmpty = !loading && !error && !debouncedSearch && data?.total === 0;

  const doInstall = () => {
    if (!selected || !targetNest) {
      return;
    }

    setInstalling(true);

    installEgg(selected.egg.eggRepository.uuid, selected.egg.uuid, targetNest.uuid)
      .then(({ egg, created }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nests.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.eggs.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.eggRepositories.eggsUnscoped() });

        addToast(
          created
            ? t('pages.admin.eggRepositories.tabs.eggs.page.toast.installed', { eggs: tItem('egg', 1) })
            : t('pages.admin.eggRepositories.tabs.eggs.page.toast.alreadyInstalled', { nest: targetNest.name }),
          'success',
        );

        onInstalled?.({ egg, nest: targetNest, created });
        props.onClose();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setInstalling(false));
  };

  return (
    <>
      <Modal.Stack>
        <Modal
          {...props}
          {...stack.register('catalog')}
          onClose={props.onClose}
          withCloseButton={false}
          padding={0}
          size='lg'
          transitionProps={{ transition: 'pop', duration: 150, onEntered: () => combobox.selectFirstOption() }}
        >
          <Combobox
            store={combobox}
            onOptionSubmit={(value) => setSelected(items.find((item) => item.egg.uuid === value) ?? null)}
            size='lg'
            withinPortal={false}
          >
            <div className='p-3 border-b border-(--mantine-color-default-border)'>
              <Combobox.Search
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') props.onClose();
                }}
                placeholder={t('pages.admin.eggRepositories.tabs.eggs.page.modal.catalog.searchPlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} size='sm' />}
                rightSection={loading ? <Spinner size={14} /> : undefined}
                data-autofocus
                styles={{
                  input: {
                    margin: 0,
                    width: '100%',
                    border: 'calc(0.0625rem * var(--mantine-scale)) solid var(--input-bd)',
                    backgroundColor: 'var(--input-bg)',
                    borderRadius: 'var(--input-radius)',
                  },
                }}
              />
            </div>

            <div className='max-h-96 overflow-y-auto p-2'>
              <Combobox.Options>
                {items.length === 0 && (
                  <Combobox.Empty>
                    {isEmpty
                      ? t('pages.admin.eggRepositories.tabs.eggs.page.modal.catalog.noEggs', {})
                      : t('elements.selectInput.noResults', {})}
                  </Combobox.Empty>
                )}

                {items.map((item, index) => (
                  <Combobox.Option
                    key={item.egg.uuid}
                    value={item.egg.uuid}
                    selected={index === combobox.selectedOptionIndex}
                    onMouseMove={() => combobox.selectOption(index)}
                  >
                    <Group gap='sm' wrap='nowrap' align='flex-start'>
                      <div className='flex flex-col min-w-0 flex-1'>
                        <Group gap='xs' wrap='nowrap'>
                          <Text size='sm' fw={500} truncate>
                            {item.egg.exportedEgg.name}
                          </Text>
                          <Badge size='xs' variant='light' className='shrink-0'>
                            {item.egg.eggRepository.name}
                          </Badge>
                        </Group>
                        <Text size='xs' c='dimmed' lineClamp={1}>
                          {item.egg.exportedEgg.description || item.egg.exportedEgg.author}
                        </Text>
                      </div>
                      {item.installedEggs.map((installed) => (
                        <Badge
                          key={installed.uuid}
                          size='xs'
                          variant='light'
                          color={isInstalledEggUpdateAvailable(item.egg.hash, installed) ? 'yellow' : 'green'}
                          className='shrink-0'
                        >
                          {installed.nest.name}
                        </Badge>
                      ))}
                      {selected?.egg.uuid === item.egg.uuid && (
                        <FontAwesomeIcon icon={faCheck} className='shrink-0 mt-1 text-(--mantine-color-blue-5)' />
                      )}
                    </Group>
                  </Combobox.Option>
                ))}
              </Combobox.Options>

              {data && data.total > items.length && (
                <Text size='xs' c='dimmed' ta='center' py='xs'>
                  {t('pages.admin.eggRepositories.tabs.eggs.page.modal.catalog.moreResults', {
                    shown: String(items.length),
                    total: String(data.total),
                  })}
                </Text>
              )}
            </div>
          </Combobox>

          <div className='border-t border-(--mantine-color-default-border) px-4 py-3'>
            {!selected ? (
              <Group gap='md' wrap='wrap'>
                <Group gap={4}>
                  <Kbd size='xs'>↑</Kbd>
                  <Kbd size='xs'>↓</Kbd>
                  <Text size='xs' c='dimmed'>
                    {t('elements.quickActions.hint.navigate', {})}
                  </Text>
                </Group>
                <Group gap={4}>
                  <Kbd size='xs'>Enter</Kbd>
                  <Text size='xs' c='dimmed'>
                    {t('elements.quickActions.hint.select', {})}
                  </Text>
                </Group>
                <Group gap={4}>
                  <Kbd size='xs'>Esc</Kbd>
                  <Text size='xs' c='dimmed'>
                    {t('elements.quickActions.hint.close', {})}
                  </Text>
                </Group>
              </Group>
            ) : (
              <Stack gap='xs'>
                <Group justify='space-between' wrap='nowrap'>
                  <Text size='sm' truncate>
                    {t('pages.admin.eggRepositories.tabs.eggs.page.modal.catalog.selected', {
                      egg: selected.egg.exportedEgg.name,
                    }).md()}
                  </Text>
                  <Button
                    variant='subtle'
                    size='compact-sm'
                    leftSection={<FontAwesomeIcon icon={faBook} />}
                    onClick={() => setReadmeOpen(true)}
                  >
                    {t('pages.admin.eggLibrary.button.readme', {})}
                  </Button>
                </Group>

                {nest ? (
                  <Text size='sm'>
                    {t('pages.admin.eggRepositories.tabs.eggs.page.modal.catalog.installingInto', {
                      nest: nest.name,
                    }).md()}
                  </Text>
                ) : (
                  <div className='flex flex-col gap-1'>
                    <NestSelect
                      withAsterisk
                      label={t('common.form.nest', {})}
                      value={targetNest?.uuid ?? null}
                      onChange={(_uuid, next) => setChosenNest(next)}
                      includeItems={[...(defaultNest ? [defaultNest] : []), ...createdNests]}
                    />
                    <NestCreateHint onClick={() => stack.open('nest')} />
                  </div>
                )}
              </Stack>
            )}

            <ModalFooter>
              <Button onClick={doInstall} loading={installing} disabled={!selected || !targetNest}>
                {confirmLabel ?? t('common.button.install', {})}
              </Button>
              <Button variant='default' onClick={props.onClose}>
                {t('common.button.close', {})}
              </Button>
            </ModalFooter>
          </div>
        </Modal>

        <NestCreateModal
          {...stack.register('nest')}
          onCreated={(created) => {
            setCreatedNests((prev) => [...prev, created]);
            setChosenNest(created);
            stack.close('nest');
          }}
        />
      </Modal.Stack>

      <EggRepositoryEggDrawer
        eggRepository={null}
        egg={selected?.egg ?? null}
        opened={readmeOpen}
        onClose={() => setReadmeOpen(false)}
        zIndex={400}
      />
    </>
  );
}
