"use client";

import { useEffect, useState } from "react";

interface StreamInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function StreamInput({
  value,
  onChange,
  placeholder = "",
  className = "",
}: StreamInputProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [userEditing, setUserEditing] = useState(false);

  useEffect(() => {
    if (!userEditing) {
      setDisplayValue(value);
    }
  }, [value, userEditing]);

  return (
    <input
      type="text"
      value={displayValue}
      placeholder={placeholder}
      className={className}
      onFocus={() => setUserEditing(true)}
      onBlur={() => setUserEditing(false)}
      onChange={(e) => {
        setDisplayValue(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}