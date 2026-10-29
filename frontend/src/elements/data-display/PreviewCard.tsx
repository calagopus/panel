import classNames from 'classnames';
import { ComponentProps, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import Card, { CardProps } from '@/elements/data-display/Card.tsx';

const GROWTH_PX = 24;
const EDGE_MARGIN_PX = 8;
const DURATION_MS = 200;
const GROW_EASING = 'cubic-bezier(0.34, 1.4, 0.64, 1)';
const SHRINK_EASING = 'cubic-bezier(0.4, 0, 0.6, 1)';
const FADE_EASING = 'cubic-bezier(0.9, 0, 1, 1)';

const horizontalBounds = (element: HTMLElement) => {
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowX === 'visible') continue;

    const left = parent.getBoundingClientRect().left + parent.clientLeft;
    return { left, right: left + parent.clientWidth };
  }

  return { left: 0, right: document.documentElement.clientWidth };
};

export type PreviewCardProps = CardProps &
  ComponentProps<'div'> & {
    preview: ReactNode;
    openDelay?: number;
  };

function PreviewCard({ preview, openDelay = 400, children, ...rest }: PreviewCardProps) {
  const [coarsePointer] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef(0);

  const applyBox = (mode: 'collapsed' | 'grow' | 'shrink') => {
    const frame = frameRef.current!;
    const content = contentRef.current!;

    let insets = '0px';
    if (mode !== 'grow') {
      const wrapper = wrapperRef.current!.getBoundingClientRect();
      const overlay = content.getBoundingClientRect();
      insets = [
        wrapper.top - overlay.top,
        overlay.right - wrapper.right,
        overlay.bottom - wrapper.bottom,
        wrapper.left - overlay.left,
      ]
        .map((inset) => `${Math.max(0, inset)}px`)
        .join(' ');
    }

    const easing = mode === 'grow' ? GROW_EASING : SHRINK_EASING;
    frame.style.transition =
      mode === 'collapsed' ? 'none' : `inset ${DURATION_MS}ms ${easing}, opacity ${DURATION_MS}ms ${FADE_EASING}`;
    content.style.transition =
      mode === 'collapsed' ? 'none' : `clip-path ${DURATION_MS}ms ${easing}, opacity ${DURATION_MS / 2}ms ease-out`;

    frame.style.inset = insets;
    frame.style.opacity = mode === 'shrink' ? '0' : '1';
    content.style.clipPath = `inset(${insets} round var(--mantine-radius-md))`;
    content.style.opacity = mode === 'grow' ? '1' : '0';
  };

  useLayoutEffect(() => {
    if (phase !== 'open' || !frameRef.current) return;

    const wrapper = wrapperRef.current!.getBoundingClientRect();
    const bounds = horizontalBounds(wrapperRef.current!);
    const growth = (room: number) => `${-Math.min(GROWTH_PX, Math.max(0, room - EDGE_MARGIN_PX))}px`;
    overlayRef.current!.style.left = growth(wrapper.left - bounds.left);
    overlayRef.current!.style.right = growth(bounds.right - wrapper.right);

    applyBox('collapsed');
    frameRef.current.getBoundingClientRect();
    applyBox('grow');
  }, [phase]);

  useEffect(() => () => window.clearTimeout(openTimerRef.current), []);

  if (coarsePointer) {
    return <Card {...rest}>{children}</Card>;
  }

  const close = () => {
    window.clearTimeout(openTimerRef.current);
    if (phase !== 'open' || !frameRef.current) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('closed');
      return;
    }

    applyBox('shrink');
    setPhase('closing');
  };

  return (
    <div
      ref={wrapperRef}
      className='relative'
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        window.clearTimeout(openTimerRef.current);
        if (phase === 'closing') setPhase('open');
        else if (phase === 'closed') openTimerRef.current = window.setTimeout(() => setPhase('open'), openDelay);
      }}
      onPointerLeave={close}
    >
      <Card {...rest} className={classNames('h-full', rest.className)}>
        {children}
      </Card>

      {phase !== 'closed' && (
        <div
          ref={overlayRef}
          className={classNames('absolute top-1/2 z-20 -translate-y-1/2', phase === 'closing' && 'pointer-events-none')}
        >
          <Card
            ref={frameRef}
            shadow='xl'
            className='absolute! inset-0 p-0! motion-reduce:transition-none!'
            onTransitionEnd={(e) => {
              if (e.target === e.currentTarget && e.propertyName === 'opacity' && phase === 'closing')
                setPhase('closed');
            }}
          />
          <Card ref={contentRef} withBorder={false} className='bg-transparent! motion-reduce:transition-none!'>
            {preview}
          </Card>
        </div>
      )}
    </div>
  );
}

export default makeComponentHookable(PreviewCard);
