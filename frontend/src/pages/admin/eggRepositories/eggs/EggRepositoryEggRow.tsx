import { forwardRef, memo } from 'react';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminEggRepositoryEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';

interface EggRepositoryEggRowProps {
  egg: z.infer<typeof adminEggRepositoryEggSchema>;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
  onOpen: () => void;
}

const EggRepositoryEggRow = memo(
  forwardRef<HTMLTableRowElement, EggRepositoryEggRowProps>(function EggRepositoryEggRow(
    { egg, isSelected, onSelectionChange, onOpen },
    ref,
  ) {
    return (
      <>
        <TableRow
          bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
          ref={ref}
          className='cursor-pointer'
          onClick={onOpen}
        >
          <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
            <Checkbox
              id={egg.uuid}
              checked={isSelected}
              onChange={(e) => {
                onSelectionChange(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              classNames={{ input: 'cursor-pointer!' }}
            />
          </TableData>

          <TableData>
            <Code>{egg.path}</Code>
          </TableData>

          <TableData>{egg.exportedEgg.name}</TableData>

          <TableData>{egg.exportedEgg.author}</TableData>

          <TableData>{egg.exportedEgg.description}</TableData>

          <TableData>
            <FormattedTimestamp timestamp={egg.updated} />
          </TableData>
        </TableRow>
      </>
    );
  }),
);

export default EggRepositoryEggRow;
