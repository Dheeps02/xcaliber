interface SpinInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  inputClassName?: string;
}

export function SpinInput({ value, onChange, min, max, step = 1, inputClassName = '' }: SpinInputProps) {
  function clamp(n: number) {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  }

  return (
    <div className="relative inline-flex w-full">
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!isNaN(n)) onChange(clamp(n));
        }}
        min={min}
        max={max}
        step={step}
        className={`no-spinner pr-5 w-full ${inputClassName}`}
      />
      {/* Buttons sit flush inside the input's right edge */}
      <div
        className="absolute inset-y-px right-px flex flex-col w-4 overflow-hidden rounded-r"
        style={{ borderLeft: '1px solid rgba(55,65,81,0.5)' }}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value + step))}
          className="flex-1 flex items-center justify-center text-gray-600 hover:text-gray-200 hover:bg-gray-700/60 text-[7px] transition-colors leading-none"
        >
          ▲
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value - step))}
          className="flex-1 flex items-center justify-center text-gray-600 hover:text-gray-200 hover:bg-gray-700/60 text-[7px] transition-colors leading-none"
          style={{ borderTop: '1px solid rgba(55,65,81,0.5)' }}
        >
          ▼
        </button>
      </div>
    </div>
  );
}
