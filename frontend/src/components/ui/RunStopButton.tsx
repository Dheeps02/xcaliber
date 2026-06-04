import { Play, Stop } from '@phosphor-icons/react';
import { Button } from './Button';

interface RunStopButtonProps {
  running: boolean;
  pending?: boolean;
  canRun?: boolean;
  canStop?: boolean;
  onRun: () => void;
  onStop?: () => void;
  className?: string;
}

const spinner = (
  <svg className="animate-spin" width="11" height="11" viewBox="0 0 10 10" fill="none">
    <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
    <path d="M5 1a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function RunStopButton({
  running, pending = false, canRun = true, canStop = true,
  onRun, onStop, className = '',
}: RunStopButtonProps) {
  const isStop   = running && !!onStop;
  const disabled = pending || (running ? !canStop : !canRun);

  return (
    <Button
      variant="ghost"
      intent={isStop ? 'danger' : 'success'}
      disabled={disabled}
      onClick={isStop ? onStop : onRun}
      className={`!px-2 !py-0.5 !text-[10px] !gap-1 ${className}`}
    >
      {pending ? (
        <>{spinner}{isStop ? 'Stopping…' : 'Starting…'}</>
      ) : isStop ? (
        <><Stop size={12} />Stop</>
      ) : (
        <><Play size={12} />Run</>
      )}
    </Button>
  );
}
