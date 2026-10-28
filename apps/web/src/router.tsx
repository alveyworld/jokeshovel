import { Navigate, createBrowserRouter } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { OutboxProvider } from './data/OutboxProvider';
import { Associations } from './routes/Associations';
import { Drafts } from './routes/Drafts';
import { AuthCallback } from './routes/AuthCallback';
import { Home } from './routes/Home';
import { Mine } from './routes/Mine';
import { NotFound } from './routes/NotFound';
import { Settings } from './routes/Settings';
import { SetupDetail } from './routes/SetupDetail';
import { Setups } from './routes/Setups';
import { SignIn } from './routes/SignIn';
import { TopicDetail } from './routes/TopicDetail';
import { Topics } from './routes/Topics';

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
        ],
      },
      { path: 's/:setupId', element: <SetupDetail /> },
      { path: 'a/:attemptId/:step?', element: <Mine /> },
      { path: 'drafts', element: <Drafts /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
