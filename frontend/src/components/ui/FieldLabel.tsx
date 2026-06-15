export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-widest leading-none"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </span>
  );
}
