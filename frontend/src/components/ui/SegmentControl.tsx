interface SegItem<T extends string> {
  value: T;
  label: string;
}

interface SegmentControlProps<T extends string> {
  items: SegItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentControl<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentControlProps<T>) {
  return (
    <div className={`xcb-segment${size === 'sm' ? ' sm' : ''} ${className}`}>
      {items.map((item) => (
        <button
          key={item.value}
          className={`xcb-seg-btn${value === item.value ? ' active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
