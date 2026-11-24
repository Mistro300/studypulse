import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import '@/styles/tokens.css';
import '@/core/i18n';
import { initWebVitalsReporter } from '@/core/observability/web-vitals';
import { queryClient } from '@/app/providers/query-client';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { router } from '@/app/routes/router';

initWebVitalsReporter();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
