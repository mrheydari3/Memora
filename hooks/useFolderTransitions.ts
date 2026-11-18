import { useEffect, useRef, useState } from 'react';
import { motion } from '../theme/tokens';
import { prefersReducedMotion } from '../motion';

/**
 * The open/close lifecycle for the shelf's inline folders.
 *
 * Collapse is committed immediately so the header's `aria-expanded` and
 * chevron tell the truth, while the deck rows stay mounted under `closing` for
 * one short fade. Expansion mounts the rows immediately under `opening`, so
 * each slice can enter without replaying whenever virtualization mounts it
 * later.
 */
export function useFolderTransitions() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [opening, setOpening] = useState<Set<string>>(() => new Set());
  const [closing, setClosing] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = (id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  };

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    []
  );

  const toggle = (id: string) => {
    clearTimer(id);
    const reduced = prefersReducedMotion();
    const isCollapsed = collapsed.has(id);


    if (isCollapsed) {
      // Re-expanding also cancels an in-flight close, so a second tap during
      // the fade returns the body to its end state instead of leaving it
      // half-faded until the old timer fires.
      setCollapsed((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setClosing((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (reduced) return;
      setOpening((current) => {
        if (current.has(id)) return current;
        const next = new Set(current);
        next.add(id);
        return next;
      });
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setOpening((current) => {
            if (!current.has(id)) return current;
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, motion.slow + 120)
      );
      return;
    }

    setCollapsed((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setOpening((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });

    if (reduced) {
      setClosing((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }

    setClosing((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setClosing((current) => {
          if (!current.has(id)) return current;
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, motion.base + 30)
    );
  };

  return { collapsed, opening, closing, toggle };
}
