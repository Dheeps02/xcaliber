export function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <div onClick={onClick} className="flex items-center gap-2 select-none cursor-pointer">
      <svg
        viewBox="0 0 256 256"
        width={22}
        height={22}
        fill="currentColor"
        className={`transition-colors shrink-0 ${active ? 'text-blue-400' : 'text-gray-600'}`}
      >
        <path
          fillRule="evenodd"
          d="M176,56H80a72,72,0,0,0,0,144h96a72,72,0,0,0,0-144Z M176,72H80a56,56,0,0,0,0,112h96a56,56,0,0,0,0-112Z"
        />
        <circle
          cx="80"
          cy="128"
          r="40"
          style={{
            transform: active ? 'translateX(37.5%)' : 'translateX(0%)',
            transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
            transformBox: 'view-box',
          }}
        />
      </svg>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}
