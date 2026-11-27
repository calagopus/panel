import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UnstyledButton } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import classNames from 'classnames';
import Switch from '@/elements/input/Switch.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import { DividerFieldDef, resolveString } from './types.ts';

interface CollapseControl {
  expanded: boolean;
  onToggle: () => void;
  controls: string;
  invalid: boolean;
}

interface Props<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  field: DividerFieldDef<T>;
  className?: string;
  collapse?: CollapseControl;
}

export function DividerHeader<T extends Record<string, unknown>>({ form, field, className, collapse }: Props<T>) {
  const label = resolveString(field.label);

  const divider = collapse ? (
    <Divider
      className='flex-1'
      labelPosition='left'
      label={
        <UnstyledButton
          type='button'
          className='inline-flex items-center gap-2'
          style={{ color: collapse.invalid ? 'var(--mantine-color-error)' : 'inherit', font: 'inherit' }}
          onClick={collapse.onToggle}
          aria-expanded={collapse.expanded}
          aria-controls={collapse.controls}
        >
          <FontAwesomeIcon
            icon={faChevronDown}
            size='xs'
            style={{
              transform: collapse.expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
            }}
          />
          {label}
        </UnstyledButton>
      }
    />
  ) : (
    <Divider className='flex-1' label={label} labelPosition='left' />
  );

  if (!field.switchName && !collapse) {
    return <Divider className={className} label={label} labelPosition='left' />;
  }

  const f = form as UseFormReturnType<Record<string, unknown>>;

  return (
    <div className={classNames(className, 'flex items-center gap-4')}>
      {divider}
      {field.switchName && (
        <Switch
          label={resolveString(field.switchLabel)}
          labelPosition='left'
          key={f.key(field.switchName)}
          {...f.getInputProps(field.switchName, { type: 'checkbox' })}
          {...field.switchProps}
        />
      )}
    </div>
  );
}
