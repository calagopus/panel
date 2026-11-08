import { MultiSelect as MantineMultiSelect, MultiSelectProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const MultiSelect = forwardRef<HTMLInputElement, MultiSelectProps>(
  ({ className, nothingFoundMessage, ...rest }, ref) => {
    const { t } = useTranslations();

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
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(MultiSelect);
