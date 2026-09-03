import { useMergedRef } from '@mantine/hooks';
import { memo, type Ref } from 'react';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import FileRow, { FileRowProps } from '@/pages/server/files/list/FileRow.tsx';

interface VirtualFileRowProps extends Omit<FileRowProps, 'dataIndex'> {
  innerRef: Ref<HTMLElement>;
  measureElement: (node: HTMLTableRowElement | null) => void;
  dataIndex: number;
}

function VirtualFileRow({ innerRef, measureElement, dataIndex, ...rowProps }: VirtualFileRowProps) {
  const mergedRef = useMergedRef<HTMLTableRowElement>(innerRef as Ref<HTMLTableRowElement>, measureElement);

  return <FileRow ref={mergedRef} dataIndex={dataIndex} {...rowProps} />;
}

const SelectableFileRow = memo(function SelectableFileRow({
  measureElement,
  dataIndex,
  ...rowProps
}: Omit<VirtualFileRowProps, 'innerRef'>) {
  return (
    <SelectionArea.Selectable item={rowProps.file}>
      {(innerRef: Ref<HTMLElement>) => (
        <VirtualFileRow innerRef={innerRef} measureElement={measureElement} dataIndex={dataIndex} {...rowProps} />
      )}
    </SelectionArea.Selectable>
  );
});

export default SelectableFileRow;
