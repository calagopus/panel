import { RefObject, useEffect } from 'react';
import { visualViewportBottomInset } from '@/plugins/viewport/useVisualViewport.ts';

interface UseContainerAutoHeightOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
  getParent: () => HTMLElement | null | undefined;
  layout: () => void;
  extraObserveRef?: RefObject<HTMLDivElement | null>;
  useVisualViewportInset?: boolean;
  /** Set this custom property to the measured height instead of sizing the element itself. */
  cssVariable?: string;
  deps: unknown[];
}

export function useContainerAutoHeight({
  containerRef,
  loading,
  getParent,
  layout,
  extraObserveRef,
  useVisualViewportInset = false,
  cssVariable,
  deps,
}: UseContainerAutoHeightOptions) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || loading) return;

    const updateHeight = () => {
      const virtualWindowEl = getParent();
      const elRect = el.getBoundingClientRect();

      let bottomEdge: number;
      if (useVisualViewportInset) {
        const visibleBottom = window.innerHeight - visualViewportBottomInset();
        bottomEdge = virtualWindowEl
          ? Math.min(virtualWindowEl.getBoundingClientRect().bottom, visibleBottom)
          : visibleBottom;
      } else {
        bottomEdge = virtualWindowEl ? virtualWindowEl.getBoundingClientRect().bottom : window.innerHeight;
      }

      const newHeight = Math.max(0, bottomEdge - elRect.top);
      if (cssVariable) el.style.setProperty(cssVariable, `${newHeight}px`);
      else el.style.height = `${newHeight}px`;

      layout();
    };

    const observer = new ResizeObserver(() => updateHeight());

    const viewport = useVisualViewportInset ? window.visualViewport : null;
    viewport?.addEventListener('resize', updateHeight);
    viewport?.addEventListener('scroll', updateHeight);

    const virtualWindowEl = getParent();
    if (virtualWindowEl) {
      observer.observe(virtualWindowEl);
    } else {
      observer.observe(document.body);
    }

    if (extraObserveRef?.current) {
      observer.observe(extraObserveRef.current);
    }

    updateHeight();

    return () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', updateHeight);
      viewport?.removeEventListener('scroll', updateHeight);
    };
  }, deps);
}
