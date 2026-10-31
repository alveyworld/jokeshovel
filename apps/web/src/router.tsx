import { Navigate, createBrowserRouter } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { OutboxProvider } from './data/OutboxProvider';
import { Associations } from './routes/Associations';
import { Drafts } from './routes/Drafts';
import { AuthCallback } from './routes/AuthCallback';
import { Home } from './routes/Home';
import { Jokes } from './routes/Jokes';
import { Mine } from './routes/Mine';
import { NotFound } from './routes/NotFound';
import { SetupDetail } from './routes/SetupDetail';
import { Setups } from './routes/Setups';
import { SignIn } from './routes/SignIn';
import { TopicDetail } from './routes/TopicDetail';
import { TopicJokes } from './routes/TopicJokes';
import { Topics } from './routes/Topics';

// Less-used screens load on demand to keep the first download small.
const lazyRoutes = {
  jokeDetail: () => import('./routes/JokeDetail').then((m) => ({ Component: m.JokeDetail })),
  search: () => import('./routes/Search').then((m) => ({ Component: m.Search })),
  settings: () => import('./routes/Settings').then((m) => ({ Component: m.Settings })),
  stats: () => import('./routes/Stats').then((m) => ({ Component: m.Stats })),
  trash: () => import('./routes/Trash').then((m) => ({ Component: m.Trash })),
};

/** Fetch the on-demand screens once the app is idle, so they're cached for offline use. */
export function preloadRoutes() {
  for (const load of Object.values(lazyRoutes)) void load().catch(() => undefined);
}

export const router = createBrowserRouter([
  { path: '/signin', element: <SignIn /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: (
      <RequireAuth>
        <OutboxProvider>
          <AppShell />
        </OutboxProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'topics', element: <Topics /> },
      {
        path: 'topics/:topicId',
        element: <TopicDetail />,
        children: [
          { index: true, element: <Navigate to="associations" replace /> },
          { path: 'associations', element: <Associations /> },
          { path: 'setups', element: <Setups /> },
          { path: 'jokes', element: <TopicJokes /> },
        ],
      },
      { path: 's/:setupId', element: <SetupDetail /> },
      { path: 'a/:attemptId/:step?', element: <Mine /> },
      { path: 'drafts', element: <Drafts /> },
      { path: 'jokes', element: <Jokes /> },
      { path: 'j/:jokeId', lazy: lazyRoutes.jokeDetail },
      { path: 'search', lazy: lazyRoutes.search },
      { path: 'stats', lazy: lazyRoutes.stats },
      { path: 'trash', lazy: lazyRoutes.trash },
      { path: 'settings', lazy: lazyRoutes.settings },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
