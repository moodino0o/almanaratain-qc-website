import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";

const navigationStateKey = "__alManaratainQcNavigation";

type AppNavigationState = {
  path: string;
  previousPath: string | null;
};

export function useAppBack(fallback: string) {
  const [location, setLocation] = useLocation();

  return useCallback(() => {
    const state = window.history.state;
    const navigation = state && typeof state === "object"
      ? (state as Record<string, unknown>)[navigationStateKey] as AppNavigationState | undefined
      : undefined;

    if (navigation?.path === location && navigation.previousPath) {
      window.history.back();
      return;
    }

    setLocation(fallback);
  }, [fallback, location, setLocation]);
}

export function useAppNavigationTracking(location: string) {
  const previousPathRef = useRef<string | null>(null);
  useEffect(() => {
    const state = window.history.state;
    const stateObject = state && typeof state === "object"
      ? state as Record<string, unknown>
      : {};
    const navigation = stateObject[navigationStateKey] as AppNavigationState | undefined;

    if (navigation?.path === location) {
      previousPathRef.current = location;
      return;
    }

    window.history.replaceState(
      {
        ...stateObject,
        [navigationStateKey]: {
          path: location,
          previousPath: previousPathRef.current,
        } satisfies AppNavigationState,
      },
      document.title,
    );
    previousPathRef.current = location;
  }, [location]);
}