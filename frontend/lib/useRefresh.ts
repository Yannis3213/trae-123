'use client';

import { useEffect, useRef, useCallback } from 'react';

export const HOTEL_EVENTS = {
  USER_SWITCHED: 'hotel:user-switched',
  ORDER_CHANGED: 'hotel:order-changed',
} as const;

export function dispatchOrderChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HOTEL_EVENTS.ORDER_CHANGED));
  }
}

export function dispatchUserSwitched() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HOTEL_EVENTS.USER_SWITCHED));
  }
}

interface UseRefreshOptions {
  onUserSwitched?: () => void | Promise<void>;
  onOrderChanged?: () => void | Promise<void>;
  onAny?: () => void | Promise<void>;
  deps?: unknown[];
}

export function useRefresh({
  onUserSwitched,
  onOrderChanged,
  onAny,
  deps = [],
}: UseRefreshOptions = {}) {
  const busyRef = useRef(false);

  const runSafe = useCallback(async (fn?: () => void | Promise<void>) => {
    if (!fn || busyRef.current) return;
    busyRef.current = true;
    try {
      await fn();
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUserSwitch = () => {
      if (onAny) runSafe(onAny);
      else if (onUserSwitched) runSafe(onUserSwitched);
    };
    const handleOrderChange = () => {
      if (onAny) runSafe(onAny);
      else if (onOrderChanged) runSafe(onOrderChanged);
    };

    window.addEventListener(HOTEL_EVENTS.USER_SWITCHED, handleUserSwitch);
    window.addEventListener(HOTEL_EVENTS.ORDER_CHANGED, handleOrderChange);

    return () => {
      window.removeEventListener(HOTEL_EVENTS.USER_SWITCHED, handleUserSwitch);
      window.removeEventListener(HOTEL_EVENTS.ORDER_CHANGED, handleOrderChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUserSwitched, onOrderChanged, onAny, runSafe, ...deps]);
}
