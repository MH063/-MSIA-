import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import SuspenseWrapper from './SuspenseWrapper';
import RedirectToInterview from './RedirectToInterview';
const Login = React.lazy(() => import('../pages/Login'));
const Register = React.lazy(() => import('../pages/Register'));
const EmailRegister = React.lazy(() => import('../pages/EmailRegister'));
const ForgotPassword = React.lazy(() => import('../pages/ForgotPassword'));
const SecuritySettings = React.lazy(() => import('../pages/SecuritySettings'));
const Home = React.lazy(() => import('../pages/Home'));
const Dashboard = React.lazy(() => import('../pages/Dashboard'));
const Interview = React.lazy(() => import('../pages/Interview'));
const NewInterview = React.lazy(() => import('../pages/Interview/NewInterview'));
const Session = React.lazy(() => import('../pages/Interview/Session'));
const SessionList = React.lazy(() => import('../pages/SessionList'));
const KnowledgeList = React.lazy(() => import('../pages/KnowledgeList'));

const router = createBrowserRouter([
  // 认证相关页面（无导航栏）
  {
    index: true,
    element: (
      <SuspenseWrapper>
        <Login />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/login',
    element: (
      <SuspenseWrapper>
        <Login />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/register',
    element: (
      <SuspenseWrapper>
        <Register />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/email-register',
    element: (
      <SuspenseWrapper>
        <EmailRegister />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <SuspenseWrapper>
        <ForgotPassword />
      </SuspenseWrapper>
    ),
  },
  // 带导航栏的页面
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '/home',
        element: (
          <SuspenseWrapper>
            <Home />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/security-settings',
        element: (
          <SuspenseWrapper>
            <SecuritySettings />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/dashboard',
        element: (
          <SuspenseWrapper>
            <Dashboard />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/sessions',
        element: (
          <SuspenseWrapper>
            <SessionList />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/sessions/:id',
        element: <RedirectToInterview />,
      },
      {
        path: '/knowledge',
        element: (
          <SuspenseWrapper>
            <KnowledgeList />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/interview',
        element: (
          <SuspenseWrapper>
            <Interview />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/interview/new',
        element: (
          <SuspenseWrapper>
            <NewInterview />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/interview/:id',
        element: (
          <SuspenseWrapper>
            <Session />
          </SuspenseWrapper>
        ),
      },
    ],
  },
]);

export default router;
