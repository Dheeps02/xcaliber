import { useRef } from 'react';
import { ArrowSquareOut, FolderOpen } from '@phosphor-icons/react';
import { Button } from './Button';

interface Props {
  onExport: () => void;
  onImport: (file: File) => void;
  accept?: string;
  exportDisabled?: boolean;
  compact?: boolean;
}

export function ImportExportButtons({ onExport, onImport, accept, exportDisabled, compact = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cls = compact ? '!px-2 !py-0.5 !text-[10px] !gap-1' : '';
  const iconSize = compact ? 13 : 14;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = '';
        }}
      />
      <Button variant="default" className={cls} onClick={onExport} disabled={exportDisabled}>
        <ArrowSquareOut size={iconSize} />Export
      </Button>
      <Button variant="default" className={cls} onClick={() => inputRef.current?.click()}>
        <FolderOpen size={iconSize} />Import
      </Button>
    </>
  );
}
