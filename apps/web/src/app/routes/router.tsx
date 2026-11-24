import { lazy, Suspense, type ComponentType } from 'react';
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { NotFoundPage } from '@/shared/ui/NotFoundPage';
import { RouteSkeleton } from '@/shared/ui/RouteSkeleton';
import { RootLayout } from './RootLayout';

function withLazyRoute(loader: () => Promise<{ default: ComponentType }>) {
  const LazyComponent = lazy(loader);
  return function LazyRouteWrapper() {
    return (
      <Suspense fallback={<RouteSkeleton />}>
        <LazyComponent />
      </Suspense>
    );
  };
}

const AuthRoutePage = withLazyRoute(() =>
  import('@/features/auth/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
);
const DashboardRoutePage = withLazyRoute(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const DecksLibraryRoutePage = withLazyRoute(() =>
  import('@/features/decks/pages/DecksLibraryPage').then((m) => ({
    default: m.DecksLibraryPage,
  })),
);
const DeckDetailRoutePage = withLazyRoute(() =>
  import('@/features/decks/pages/DeckDetailPage').then((m) => ({ default: m.DeckDetailPage })),
);
const SoloStudyRoutePage = withLazyRoute(() =>
  import('@/features/study/pages/SoloStudyPage').then((m) => ({ default: m.SoloStudyPage })),
);
const LiveRoomsHubRoutePage = withLazyRoute(() =>
  import('@/features/rooms/pages/LiveRoomsHubPage').then((m) => ({
    default: m.LiveRoomsHubPage,
  })),
);
const LiveRoomLobbyRoutePage = withLazyRoute(() =>
  import('@/features/rooms/pages/LiveRoomLobbyPage').then((m) => ({
    default: m.LiveRoomLobbyPage,
  })),
);
const ActiveLiveQuizRoutePage = withLazyRoute(() =>
  import('@/features/rooms/pages/ActiveLiveQuizPage').then((m) => ({
    default: m.ActiveLiveQuizPage,
  })),
);
const AnalyticsRoutePage = withLazyRoute(() =>
  import('@/features/analytics/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const SettingsRoutePage = withLazyRoute(() =>
  import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthRoutePage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardRoutePage,
});

const decksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/decks',
  component: DecksLibraryRoutePage,
});

const deckDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/decks/$deckId',
  component: DeckDetailRoutePage,
});

const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/study',
  validateSearch: (search: Record<string, unknown>): { deckId?: string } => ({
    deckId: typeof search.deckId === 'string' && search.deckId.length > 0 ? search.deckId : undefined,
  }),
  component: SoloStudyRoutePage,
});

const roomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rooms',
  component: LiveRoomsHubRoutePage,
});

const roomLobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rooms/$code',
  component: LiveRoomLobbyRoutePage,
});

const roomLiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rooms/$code/live',
  component: ActiveLiveQuizRoutePage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: AnalyticsRoutePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoutePage,
});

const routeTree = rootRoute.addChildren([
  authRoute,
  indexRoute,
  decksRoute,
  deckDetailRoute,
  studyRoute,
  roomsRoute,
  roomLobbyRoute,
  roomLiveRoute,
  analyticsRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundPage,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
