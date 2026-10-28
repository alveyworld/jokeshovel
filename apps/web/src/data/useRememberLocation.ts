import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useMutations } from './hooks';

/** Records the current screen as the "Resume digging" target. */
export function useRememberLocation(label: string | null) {
  const { pathname } = useLocation();
  const { rememberLocation } = useMutations();
  useEffect(() => {
    if (!label) return;
    rememberLocation({ route: pathname, label, at: new Date().toISOString() });
  }, [pathname, label, rememberLocation]);
}
