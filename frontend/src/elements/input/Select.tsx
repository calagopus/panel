import {
  ComboboxItem,
  getOptionsLockup,
  getParsedComboboxData,
  Select as MantineSelect,
  SelectProps,
} from '@mantine/core';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const Select = forwardRef<HTMLInputElement, SelectProps>(
  (
    {
      className,
      allowDeselect = false,
      data,
      value,
      onChange,
      searchValue,
      onSearchChange,
      nothingFoundMessage,
      ...rest
    },
    ref,
  ) => {
    const { t } = useTranslations();

    const optionsLockup = useMemo(() => getOptionsLockup(getParsedComboboxData(data)), [data]);
    const lastSelected = useRef<ComboboxItem | null>(null);

    const [displaySearch, setDisplaySearch] = useState(searchValue ?? '');
    const lastForwardedSearch = useRef(searchValue);

    useEffect(() => {
      if (searchValue !== undefined && searchValue !== lastForwardedSearch.current) {
        lastForwardedSearch.current = searchValue;
        setDisplaySearch(searchValue);
      }
    }, [searchValue]);

    const getSelectedLabel = () => {
      const selectedValue = value !== undefined ? value : lastSelected.current?.value;
      if (selectedValue == null) return null;

      return (
        optionsLockup[selectedValue]?.label ??
        (lastSelected.current?.value === selectedValue ? lastSelected.current.label : null)
      );
    };

    const searchProps: Pick<SelectProps, 'searchValue' | 'onSearchChange'> = onSearchChange
      ? {
          searchValue: displaySearch,
          onSearchChange: (search) => {
            setDisplaySearch(search);

            const forwarded = search === getSelectedLabel() ? '' : search;
            lastForwardedSearch.current = forwarded;
            onSearchChange(forwarded);
          },
        }
      : { searchValue };

    return (
      <MantineSelect
        ref={ref}
        className={className}
        allowDeselect={allowDeselect}
        nothingFoundMessage={
          rest.loading ? (
            <div className='flex justify-center'>
              <Spinner size={16} />
            </div>
          ) : (
            (nothingFoundMessage ?? t('elements.selectInput.noResults', {}))
          )
        }
        placeholder={typeof rest.label === 'string' ? rest.label : undefined}
        data={data}
        value={value}
        onChange={(v, option) => {
          lastSelected.current = option;
          onChange?.(v, option);
        }}
        {...searchProps}
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(Select);
