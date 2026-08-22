import { AutocompleteProps, Autocomplete as MantineAutocomplete } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Autocomplete = forwardRef<HTMLInputElement, AutocompleteProps>(({ className, value, ...rest }, ref) => {
  return (
    <MantineAutocomplete
      ref={ref}
      className={className}
      placeholder={typeof rest.label === 'string' ? rest.label : undefined}
      value={value ?? ''}
      {...rest}
    />
  );
});

export default makeComponentHookable(Autocomplete);
