import {
  ComboboxItem,
  getOptionsLockup,
  getParsedComboboxData,
  Select as MantineSelect,
  OptionsFilter,
  SelectProps as MantineSelectProps,
} from '@mantine/core';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { InfiniteScroll, useInfiniteScrollOptions } from '@/elements/input/infiniteScrollOptions.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const passthroughFilter: OptionsFilter = ({ options }) => options;

export interface SelectProps extends MantineSelectProps {
  infiniteScroll?: InfiniteScroll;
}

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
      infiniteScroll,
      filter,
      renderOption,
      ...rest
    },
    ref,
  ) => {
    const { t } = useTranslations();
    const infiniteOptions = useInfiniteScrollOptions({
      infiniteScroll,
      data,
      filter: filter ?? (onSearchChange ? passthroughFilter : undefined),
      renderOption,
    });

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

    const searchProps: Pick<MantineSelectProps, 'searchValue' | 'onSearchChange'> = onSearchChange
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
        data={infiniteOptions.data}
        filter={infiniteOptions.filter}
        renderOption={infiniteOptions.renderOption}
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
