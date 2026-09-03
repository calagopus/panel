import { useEffect, useState } from 'react';
import Progress from '@/elements/feedback/Progress.tsx';

export default function FailedOperationProgress({ failedAt, lingerMs }: { failedAt: number; lingerMs: number }) {
  const [remaining] = useState(() => Math.max(0, lingerMs - (Date.now() - failedAt)));
  const [drained, setDrained] = useState(false);

  useEffect(() => {
    let inner: number;
    const frame = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDrained(true));
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <Progress
      value={drained ? 0 : (remaining / lingerMs) * 100}
      color='red'
      hourglass={false}
      withLabel={false}
      transitionDuration={remaining}
      styles={{ section: { transitionTimingFunction: 'linear' } }}
    />
  );
}
