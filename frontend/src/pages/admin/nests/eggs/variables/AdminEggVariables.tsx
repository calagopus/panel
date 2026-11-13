import { rectSortingStrategy } from '@dnd-kit/sortable';
import { faPlus, faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps, memo, startTransition, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import getEggVariables from '@/api/admin/nests/eggs/variables/getEggVariables.ts';
import updateEggVariableOrder from '@/api/admin/nests/eggs/variables/updateEggVariableOrder.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { adminEggSchema, adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import EggVariableContainer from '@/pages/admin/nests/eggs/variables/EggVariableContainer.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type EggVariableItem = z.infer<typeof adminEggVariableSchema> & { clientId?: string };

interface DndEggVariable extends EggVariableItem, DndItem {
  id: string;
}

let nextClientId = 0;

const MemoizedEggVariableContainer = memo(EggVariableContainer);

export default function AdminEggVariables({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const canUpdate = useAdminCan('eggs.update');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [eggVariables, setEggVariables] = useState<EggVariableItem[]>([]);

  const loadVariables = () => {
    setLoading(true);
    setError(null);

    getEggVariables(contextNest.uuid, contextEgg.uuid)
      .then((data) => {
        setEggVariables(data);
      })
      .catch((err) => {
        setError(err);
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadVariables, []);

  const addVariable = () => {
    const newVariable: EggVariableItem = {
      clientId: `new-${++nextClientId}`,
      uuid: '',
      name: '',
      nameTranslations: {},
      description: null,
      descriptionTranslations: {},
      order: eggVariables.reduce((max, v) => Math.max(max, v.order), 0) + 1,
      envVariable: '',
      defaultValue: null,
      userViewable: true,
      userEditable: false,
      isSecret: false,
      rules: [],
      created: new Date(),
    };
    setEggVariables([newVariable, ...eggVariables]);
  };

  const isEmpty = !loading && !error && eggVariables.length === 0;

  const sortedEggVariables = useMemo(() => [...eggVariables].sort((a, b) => a.order - b.order), [eggVariables]);

  const dndEggVariables: DndEggVariable[] = useMemo(
    () => sortedEggVariables.map((variable) => ({ ...variable, id: variable.uuid || variable.clientId || '' })),
    [sortedEggVariables],
  );

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.title', {})}
      titleOrder={2}
      contentRight={
        isEmpty ? undefined : (
          <AdminCan action='eggs.update'>
            <Button onClick={addVariable} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
              {t('common.button.add', {})}
            </Button>
          </AdminCan>
        )
      }
    >
      {loading ? (
        <Spinner.Centered />
      ) : error ? (
        <ErrorState error={httpErrorToHuman(error)} onRetry={loadVariables} />
      ) : isEmpty ? (
        <EmptyState
          icon={faSliders}
          title={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.empty.title', {})}
          description={
            canUpdate
              ? t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.empty.description', {})
              : t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.empty.descriptionReadOnly', {})
          }
        >
          <AdminCan action='eggs.update'>
            <Button onClick={addVariable} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
              {t('common.button.add', {})}
            </Button>
          </AdminCan>
        </EmptyState>
      ) : (
        <DndContainer
          items={dndEggVariables}
          strategy={rectSortingStrategy}
          callbacks={{
            onDragEnd: async (reorderedVariables) => {
              const variablesWithNewOrder = reorderedVariables.map((step, index) => ({
                ...step,
                order: index + 1,
              }));

              startTransition(() => {
                setEggVariables(variablesWithNewOrder);
              });

              await updateEggVariableOrder(
                contextNest.uuid,
                contextEgg.uuid,
                reorderedVariables.filter((s) => s.uuid).map((s) => s.uuid),
              ).catch((error) => {
                addToast(httpErrorToHuman(error), 'error');
                setEggVariables(eggVariables);
              });
            },
          }}
          renderOverlay={(activeVariable) =>
            activeVariable ? (
              <div style={{ cursor: 'grabbing' }}>
                <MemoizedEggVariableContainer
                  contextNest={contextNest}
                  contextEgg={contextEgg}
                  contextVariable={activeVariable}
                  eggVariables={eggVariables}
                  setEggVariables={setEggVariables}
                  removeEggVariable={(v) => setEggVariables((prev) => prev.filter((x) => x.uuid !== v.uuid))}
                />
              </div>
            ) : null
          }
        >
          {(items) => (
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4'>
              {items.map((variable) => (
                <SortableItem
                  key={variable.id}
                  id={variable.id}
                  disabled={!canUpdate}
                  renderItem={({ dragHandleProps }) => (
                    <MemoizedEggVariableContainer
                      key={variable.id}
                      contextNest={contextNest}
                      contextEgg={contextEgg}
                      contextVariable={variable}
                      eggVariables={eggVariables}
                      setEggVariables={setEggVariables}
                      removeEggVariable={(v) => setEggVariables((prev) => prev.filter((x) => x.uuid !== v.uuid))}
                      dragHandleProps={dragHandleProps as unknown as ComponentProps<'button'>}
                    />
                  )}
                />
              ))}
            </div>
          )}
        </DndContainer>
      )}
    </AdminSubContentContainer>
  );
}
