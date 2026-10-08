import { ReactNode, startTransition, useEffect, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import {
  bestRateUnit,
  bestUnit,
  formatUnitBytes,
  mapRateUnitToLocale,
  mapUnitToLocale,
  mbToBytes,
  RATE_UNITS,
  RateUnit,
  rateUnitFactor,
  UNITS,
  Unit,
  unitToBytes,
} from '@/lib/format/size.ts';
import NumberInput from './NumberInput.tsx';
import Select from './Select.tsx';

interface SizeInputProps {
  label?: ReactNode;
  description?: string;
  withAsterisk?: boolean;
  mode: 'b' | 'mb' | 'bps';
  min: number;
  value: number;
  className?: string;
  onChange: (value: number) => void;
}

function SizeInput({ mode, min, value, onChange, ...rest }: SizeInputProps) {
  const isSpecialValue = value === -1;
  const toBase = (value: number) => (mode === 'mb' ? mbToBytes(value) : value);
  const fromBase = (value: number) => (mode === 'mb' ? value / (1024 * 1024) : value);
  const bytes = isSpecialValue ? -1 : toBase(value);

  const availableUnits: readonly (Unit | RateUnit)[] = mode === 'bps' ? RATE_UNITS : UNITS.slice(mode === 'mb' ? 2 : 0);

  const getAppropriateUnit = (bytes: number): Unit | RateUnit => {
    if (mode === 'bps') return bestRateUnit(bytes);
    if (bytes <= 0) return availableUnits[0];
    return bestUnit(bytes, availableUnits as Unit[]);
  };

  const formatUnit = (unit: Unit | RateUnit, base: number) =>
    mode === 'bps' ? base / rateUnitFactor(unit as RateUnit) : formatUnitBytes(unit as Unit, base);
  const unitToBase = (unit: Unit | RateUnit, value: number) =>
    mode === 'bps' ? Math.round(value * rateUnitFactor(unit as RateUnit)) : unitToBytes(unit as Unit, value);

  const [unit, setUnit] = useState(() => getAppropriateUnit(bytes));
  const [displayValue, setDisplayValue] = useState(isSpecialValue ? -1 : formatUnit(unit, bytes));
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (value === -1) {
      setDisplayValue(-1);
    } else {
      const bytes = toBase(value);

      startTransition(() => {
        if (!isInternalChange.current) {
          const newUnit = getAppropriateUnit(bytes);
          setUnit(newUnit);
          setDisplayValue(formatUnit(newUnit, bytes));
        } else {
          setDisplayValue(formatUnit(unit, bytes));
        }
      });
    }
    isInternalChange.current = false;
  }, [value, mode]);

  const handleUnitChange = (newUnit: string | null) => {
    if (displayValue === -1 || !newUnit) return;

    const newBytes = unitToBase(newUnit as Unit | RateUnit, displayValue);

    isInternalChange.current = true;

    startTransition(() => {
      setUnit(newUnit as Unit | RateUnit);
      onChange(fromBase(newBytes));
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
    const newBytes = unitToBase(unit, newValue);
    onChange(fromBase(newBytes));
  };

  const displayMin = min === -1 ? -1 : formatUnit(unit, toBase(min));

  return (
    <NumberInput
      {...rest}
      min={displayMin}
      value={displayValue}
      onChange={handleValueChange}
      hideControls
      rightSectionWidth={mode === 'bps' ? 104 : 80}
      rightSection={
        <Select
          data={availableUnits.map((u) => ({
            label: mode === 'bps' ? mapRateUnitToLocale(u as RateUnit) : mapUnitToLocale(u as Unit),
            value: u,
          }))}
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
            wrapper: {
              marginTop: 2,
            },
          }}
        />
      }
    />
  );
}

export default makeComponentHookable(SizeInput);
