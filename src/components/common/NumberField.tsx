import React, { useEffect, useRef, useState } from 'react';

interface NumberFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
}

// Drop-in replacement for <input type="number" value={n} onChange={...}> that
// fixes a bug present everywhere that pattern was used: since
// Number('') === 0, clearing the field to type a new value made it snap
// straight back to a displayed "0" instead of going blank, so backspacing
// never actually let you erase and retype. This keeps its own draft text
// while focused (so the field can go empty mid-edit) and only reconciles
// with the external numeric value on blur or when the value changes from
// outside while not focused.
export const NumberField: React.FC<NumberFieldProps> = ({ value, onChange, onFocus, onBlur, ...rest }) => {
  const [raw, setRaw] = useState(String(value));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setRaw(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      value={raw}
      onFocus={(e) => {
        isFocused.current = true;
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        // Let the field sit blank/mid-typing (e.g. "-", "") without forcing
        // a 0 onto the parent's state - only commit a real number upward.
        if (next === '' || next === '-') return;
        const num = Number(next);
        if (!Number.isNaN(num)) onChange(num);
      }}
      onBlur={(e) => {
        isFocused.current = false;
        setRaw(String(value));
        onBlur?.(e);
      }}
    />
  );
};
