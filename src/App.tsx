import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import Logo from './components/Logo'
import Login from './pages/Login'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'

const Template = lazy(() => import('./pages/Template'))
const ScanExam = lazy(() => import('./pages/ScanExam'))
const StudentLabels = lazy(() => import('./pages/StudentLabels'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="loading-screen">Caricamento...</div>
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function Header() {
  const { session } = useAuth()
  if (!session) return null
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <Logo />
        Gestore Esami
      </Link>
      <button className="link-btn" onClick={() => supabase.auth.signOut()}>
        Esci
      </button>
    </header>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Suspense fallback={<div className="loading-screen">Caricamento...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Courses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/corsi/:courseId"
            element={
              <ProtectedRoute>
                <CourseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/corsi/:courseId/appelli/:appelloId/template"
            element={
              <ProtectedRoute>
                <Template />
              </ProtectedRoute>
            }
          />
          <Route
            path="/corsi/:courseId/etichette"
            element={
              <ProtectedRoute>
                <StudentLabels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scansiona"
            element={
              <ProtectedRoute>
                <ScanExam />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  )
}
