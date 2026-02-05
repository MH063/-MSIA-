import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Home from '../pages/Home';
import Dashboard from '../pages/Dashboard';
import Interview from '../pages/Interview';
import NewInterview from '../pages/Interview/NewInterview';
import Session from '../pages/Interview/Session';
import SessionList from '../pages/SessionList';
import KnowledgeList from '../pages/KnowledgeList';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Login />,
      },
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/register',
        element: <Register />,
      },
      {
        path: '/home',
        element: <Home />,
      },
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/sessions',
        element: <SessionList />,
      },
      {
        path: '/knowledge',
        element: <KnowledgeList />,
      },
      {
        path: '/interview',
        element: <Interview />,
      },
      {
        path: '/interview/new',
        element: <NewInterview />,
      },
      {
        path: '/interview/:id',
        element: <Session />,
      },
    ],
  },
]);

export default router;
