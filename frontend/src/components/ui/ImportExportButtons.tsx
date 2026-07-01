import { useRef } from 'react';
import { ArrowSquareOut, FolderOpen } from '@phosphor-icons/react';
import { Button } from './Button';

interface Props {
  onExport: () => void;
  onImport: (file: File) => void;
  accept?: string;
  exportDisabled?: boolean;
}

export function ImportExportButtons({ onExport, onImport, accept, exportDisabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

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
      <Button
        variant="default"
        className="!px-2 !py-0.5 !text-[10px] !gap-1"
        onClick={onExport}
        disabled={exportDisabled}
      >
        <ArrowSquareOut size={13} />Export
      </Button>
      <Button
        variant="default"
        className="!px-2 !py-0.5 !text-[10px] !gap-1"
        onClick={() => inputRef.current?.click()}
      >
        <FolderOpen size={13} />Import
      </Button>
    </>
  );
}
