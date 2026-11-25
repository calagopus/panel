import classNames from 'classnames';
import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';

const MIN_DURATION = 6;
const MAX_DURATION = 30;

const SPEED = 20;

export default function ScrollingText({ children, className }: { children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);

    const handler = () => setReducedMotion(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      const overflow = content.scrollWidth - container.clientWidth;
      setDistance(overflow > 1 ? overflow : 0);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);

    return () => observer.disconnect();
  }, []);

  const animate = distance > 0 && !reducedMotion;
  const duration = Math.min(Math.max(distance / SPEED, MIN_DURATION), MAX_DURATION);

  return (
    <span ref={containerRef} className={classNames('block overflow-hidden whitespace-nowrap min-w-0', className)}>
      <span
        ref={contentRef}
        className={classNames('inline-block align-top', animate ? 'animate-scrolling-text' : 'truncate max-w-full')}
        style={
          animate
            ? ({
                animationDuration: `${duration}s`,
                '--scrolling-text-distance': `-${distance}px`,
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
