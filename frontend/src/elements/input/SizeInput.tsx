import { StyleProp } from '@mantine/core';
import { startTransition, useEffect, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { closestUnit, formatUnitBytes, mapUnitToLocale, mbToBytes, UNITS, unitToBytes } from '@/lib/size.ts';
import NumberInput from './NumberInput.tsx';
import Select from './Select.tsx';

interface SizeInputProps {
  label?: string;
  description?: string;
  withAsterisk?: boolean;
  mode: 'b' | 'mb';
  min: number;
  value: number;
  onChange: (value: number) => void;
  flex?: StyleProp<React.CSSProperties['flex']>;
}

function SizeInput({ mode, min, value, onChange, flex, ...rest }: SizeInputProps) {
  const isSpecialValue = value === -1;
  const bytes = isSpecialValue ? -1 : mode === 'b' ? value : mbToBytes(value);

  const availableUnits = UNITS.slice(mode === 'mb' ? 2 : 0);

  const getAppropriateUnit = (bytes: number) => {
    if (bytes <= 0) return availableUnits[0];
    const closest = closestUnit(bytes);
    return availableUnits.includes(closest) ? closest : availableUnits[0];
  };

  const [unit, setUnit] = useState(() => getAppropriateUnit(bytes));
  const [displayValue, setDisplayValue] = useState(isSpecialValue ? -1 : formatUnitBytes(unit, bytes));

  const isInternalChange = useRef(false);

  useEffect(() => {
    if (value === -1) {
      setDisplayValue(-1);
    } else {
      const bytes = mode === 'b' ? value : mbToBytes(value);

      startTransition(() => {
        if (!isInternalChange.current) {
          const newUnit = getAppropriateUnit(bytes);
          setUnit(newUnit);
          setDisplayValue(formatUnitBytes(newUnit, bytes));
        } else {
          setDisplayValue(formatUnitBytes(unit, bytes));
        }
      });
    }
    isInternalChange.current = false;
  }, [value, mode]);

  const handleUnitChange = (newUnit: string | null) => {
    if (displayValue === -1 || !newUnit) return;

    const newBytes = unitToBytes(newUnit as never, displayValue);

    isInternalChange.current = true;

    startTransition(() => {
      setUnit(newUnit as never);
      onChange(mode === 'b' ? newBytes : newBytes / (1024 * 1024));
    });
  };

  const handleValueChange = (v: { valueOf: () => string | number }) => {
    const newValue = Number(v.valueOf());
    if (Number.isNaN(newValue)) return;

    setDisplayValue(newValue);

    if (newValue === -1) {
      onChange(-1);
      return;
    }

    isInternalChange.current = true;
    const newBytes = unitToBytes(unit, newValue);
    onChange(mode === 'b' ? newBytes : newBytes / (1024 * 1024));
  };

  return (
    <NumberInput
      {...rest}
      min={min}
      value={displayValue}
      onChange={handleValueChange}
      hideControls
      flex={flex}
      rightSectionWidth={80}
      rightSection={
        <Select
          data={availableUnits.map((u) => ({ label: mapUnitToLocale(u), value: u }))}
          value={unit}
          onChange={handleUnitChange}
          variant='unstyled'
          styles={{
            input: {
              paddingLeft: 8,
              paddingRight: 8,
              textAlign: 'right',
              cursor: 'pointer',
            },
          }}
        />
      }
    />
  );
}

export default makeComponentHookable(SizeInput);
