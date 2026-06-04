import { useState, useEffect, useRef } from 'react';

interface Options {
  interval?: number;
  epoch?: number;
}

export function useRotatingPreview(previews: string[], options: Options): string {
  const [index, setIndex] = useState(0);
  const prevEpochRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (options.interval === undefined || previews.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % previews.length), options.interval);
    return () => clearInterval(id);
  }, [previews.length, options.interval]);

  useEffect(() => {
    if (options.epoch === undefined) return;
    if (prevEpochRef.current === undefined) { prevEpochRef.current = options.epoch; return; }
    if (options.epoch !== prevEpochRef.current) {
      setIndex((i) => (i + 1) % previews.length);
      prevEpochRef.current = options.epoch;
    }
  }, [options.epoch, previews.length]);

  return previews[index] ?? '';
}
