import { rectSortingStrategy } from '@dnd-kit/sortable';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { memo, startTransition, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import getEggVariables from '@/api/admin/nests/eggs/variables/getEggVariables.ts';
import updateEggVariableOrder from '@/api/admin/nests/eggs/variables/updateEggVariableOrder.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { adminEggSchema, adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import EggVariableContainer from '@/pages/admin/nests/eggs/variables/EggVariableContainer.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

interface DndEggVariable extends z.infer<typeof adminEggVariableSchema>, DndItem {
  id: string;
}

const MemoizedEggVariableContainer = memo(EggVariableContainer);

export default function AdminEggVariables({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
}) {
  const { eggVariables, setEggVariables, addEggVariable } = useAdminStore();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEggVariables(contextNest.uuid, contextEgg.uuid)
      .then((data) => {
        setEggVariables(data);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  const addVariable = () => {
    addEggVariable({
      uuid: '',
      name: '',
      nameTranslations: {},
      description: null,
      descriptionTranslations: {},
      order: Number.isFinite(Math.max(...eggVariables.map((s) => s.order)))
        ? Math.max(...eggVariables.map((s) => s.order)) + 1
        : 1,
      envVariable: '',
      defaultValue: null,
      userViewable: true,
      userEditable: false,
      isSecret: false,
      rules: [],
      created: new Date(),
    });
  };

  const sortedEggVariables = useMemo(() => [...eggVariables].sort((a, b) => a.order - b.order), [eggVariables]);

  const dndEggVariables: DndEggVariable[] = sortedEggVariables.map((variable) => ({
    ...variable,
    id: variable.uuid,
  }));

  return (
    <AdminSubContentContainer
      title='Egg Variables'
      titleOrder={2}
      contentRight={
        <Button onClick={addVariable} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          Add
        </Button>
      }
    >
      {loading ? (
        <Spinner.Centered />
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
                reorderedVariables.map((s) => s.uuid),
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
                />
              </div>
            ) : null
          }
        >
          {(items) => (
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4'>
              {items.map((variable, index) => (
                <SortableItem
                  key={variable.id}
                  id={variable.id}
                  renderItem={({ dragHandleProps }) => (
                    <div {...dragHandleProps} className='h-full'>
                      <MemoizedEggVariableContainer
                        key={variable.uuid ?? index}
                        contextNest={contextNest}
                        contextEgg={contextEgg}
                        contextVariable={variable}
                      />
                    </div>
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
