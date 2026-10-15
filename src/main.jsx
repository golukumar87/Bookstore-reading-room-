import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { AccessibilityProvider } from './accessibility.jsx'

const App = lazy(() => import('./App.jsx'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard.jsx'))
const WelcomePage = lazy(() => import('./components/WelcomePage.jsx'))

function LazyRoute({ children }) {
  return <Suspense fallback={<div role="status">Loading page…</div>}>{children}</Suspense>
}

function HomeRoute() {
  const location = useLocation()
  return location.state?.welcomeCompleted
    ? <LazyRoute><App /></LazyRoute>
    : <Navigate to="/welcome" replace />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AccessibilityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/welcome" element={<LazyRoute><WelcomePage /></LazyRoute>} />
          <Route path="/admin" element={<LazyRoute><AdminDashboard /></LazyRoute>} />
          <Route path="*" element={<LazyRoute><App /></LazyRoute>} />
        </Routes>
      </BrowserRouter>
    </AccessibilityProvider>
  </React.StrictMode>
)
