import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/Toasts';
import { applyPreferences, cachedPreferences } from './lib/preferences';
import { preloadRoutes, router } from './router';
import '@fontsource/alfa-slab-one/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';

// Theme, Expert mode and reduced motion from this device, before the first paint.
applyPreferences(cachedPreferences());

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true } },
});

// App-shell caching and install (public/sw.js). Production builds only: in
// development it would cache Vite's live modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
window.addEventListener('load', () => {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
  idle(() => preloadRoutes());
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
