import { BrowserRouter, Routes, Route } from 'react-router';
import Layout from './components/common/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { TournamentProvider } from './contexts/TournamentContext';
import Home from './pages/Home';
import MentionsLegales from './pages/MentionsLegales';
import Qualifications from './pages/Qualifications';
import Overlay from './pages/Overlay';
import Finale from './pages/Finale';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import ProtectedRoute from './components/admin/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <TournamentProvider>
        <BrowserRouter>
          <Routes>
            {/* Pages publiques avec layout */}
            <Route
              path="/"
              element={
                <Layout>
                  <Home />
                </Layout>
              }
            />
            <Route
              path="/mentions-legales"
              element={
                <Layout>
                  <MentionsLegales />
                </Layout>
              }
            />
            <Route
              path="/qualifications"
              element={
                <Layout>
                  <Qualifications />
                </Layout>
              }
            />
            <Route
              path="/finale"
              element={
                <Layout>
                  <Finale />
                </Layout>
              }
            />
            {/* Overlay OBS — hors Layout (pas de header/nav/footer) */}
            <Route path="/overlay" element={<Overlay />} />

            {/* Backoffice admin (sans layout public) */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TournamentProvider>
    </AuthProvider>
  );
}

export default App;
