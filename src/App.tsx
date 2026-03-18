import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { MediaProvider } from "./context/MediaContext";
import BrowsePage from "./pages/Browse";
import HistoryPage from "./pages/History";
import LoginPage from "./pages/Login";
import MovieDetailPage from "./pages/MovieDetail";
import ProfilePage from "./pages/Profile";
import SignupPage from "./pages/Signup";
import WatchlistPage from "./pages/Watchlist";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <MediaProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </MediaProvider>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/browse" element={<ProtectedRoute><BrowsePage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/movie/:id" element={<ProtectedRoute><MovieDetailPage /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
