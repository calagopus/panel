import { MultiSelect as MantineMultiSelect, MultiSelectProps as MantineMultiSelectProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { InfiniteScroll, useInfiniteScrollOptions } from '@/elements/input/infiniteScrollOptions.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface MultiSelectProps extends MantineMultiSelectProps {
  infiniteScroll?: InfiniteScroll;
}

const MultiSelect = forwardRef<HTMLInputElement, MultiSelectProps>(
  ({ className, nothingFoundMessage, infiniteScroll, data, filter, renderOption, ...rest }, ref) => {
    const { t } = useTranslations();
    const infiniteOptions = useInfiniteScrollOptions({ infiniteScroll, data, filter, renderOption });

    return (
      <MantineMultiSelect
        ref={ref}
        className={className}
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
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(MultiSelect);
