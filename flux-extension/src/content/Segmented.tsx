import React from "react";

export interface Option<T> {
  value: T;
  label: string;
}

export interface SegmentedProps<T> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, className = "" }: SegmentedProps<T>) {
  return (
    <div className={`promptly-segmented ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={value === opt.value ? "active" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
