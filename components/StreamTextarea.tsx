"use client";

import { useEffect, useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export default function StreamTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 8,
}: Props) {
  const [displayValue, setDisplayValue] = useState(value);
  const [userEditing, setUserEditing] = useState(false);

  // Igual que StreamInput: se actualiza al instante con el valor recibido
  // (sin animación de "escritura"), y solo deja de sincronizarse mientras
  // el usuario está escribiendo activamente en el campo.
  useEffect(() => {
    if (!userEditing) {
      setDisplayValue(value);
    }
  }, [value, userEditing]);

  return (
    <textarea
      rows={rows}
      className={className}
      placeholder={placeholder}
      value={displayValue}
      onFocus={() => setUserEditing(true)}
      onBlur={() => setUserEditing(false)}
      onChange={(e) => {
        setDisplayValue(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}
