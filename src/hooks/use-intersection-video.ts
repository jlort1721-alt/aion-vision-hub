import { useEffect, useRef, useState } from 'react';

/**
 * Shared IntersectionObserver singleton — one observer for all camera cells.
 * Fires callback when element enters/exits viewport with 100px margin.
 */
const callbacks = new Map<Element, (visible: boolean) => void>();
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = callbacks.get(entry.target);
          if (cb) cb(entry.isIntersecting);
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    );
  }
  return sharedObserver;
}

export function useIntersectionVideo<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = getObserver();
    callbacks.set(el, setIsVisible);
    observer.observe(el);

    return () => {
      observer.unobserve(el);
      callbacks.delete(el);
    };
  }, []);

  return { containerRef, isVisible };
}
