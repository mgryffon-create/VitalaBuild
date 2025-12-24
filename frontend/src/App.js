import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Pages
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import SeekerDashboard from "@/pages/SeekerDashboard";
import PosterDashboard from "@/pages/PosterDashboard";
import ProfileBuilder from "@/pages/ProfileBuilder";
import SwipePage from "@/pages/SwipePage";
import MatchesPage from "@/pages/MatchesPage";
import DocumentsPage from "@/pages/DocumentsPage";
import ReferencesPage from "@/pages/ReferencesPage";
import SettingsPage from "@/pages/SettingsPage";
import JobFormPage from "@/pages/JobFormPage";
import ReferenceSubmitPage from "@/pages/ReferenceSubmitPage";
import LicensesPage from "@/pages/LicensesPage";
import VerificationAdminPage from "@/pages/VerificationAdminPage";
import SwipeBinsPage from "@/pages/SwipeBinsPage";
import FeedPage from "@/pages/FeedPage";
import InterviewsPage from "@/pages/InterviewsPage";
import HiringSuitePage from "@/pages/HiringSuitePage";
import MyOffersPage from "@/pages/MyOffersPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Axios interceptor for auth
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "seeker" ? "/seeker" : "/poster"} replace />;
  }
  
  return children;
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      
      if (token && storedUser) {
        try {
          const response = await axios.get(`${API}/auth/me`);
          setUser(response.data);
          localStorage.setItem("user", JSON.stringify(response.data));
        } catch (error) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    toast.success("Welcome back!");
    return userData;
  };

  const register = async (email, password, role, full_name) => {
    const response = await axios.post(`${API}/auth/register`, {
      email,
      password,
      role,
      full_name,
    });
    const { access_token, user: userData } = response.data;
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    toast.success("Account created successfully!");
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    toast.success("Logged out successfully");
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/references/submit/:token" element={<ReferenceSubmitPage />} />
          
          {/* Seeker Routes */}
          <Route
            path="/seeker"
            element={
              <ProtectedRoute allowedRoles={["seeker"]}>
                <SeekerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seeker/swipe"
            element={
              <ProtectedRoute allowedRoles={["seeker"]}>
                <SwipePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seeker/profile"
            element={
              <ProtectedRoute allowedRoles={["seeker"]}>
                <ProfileBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seeker/documents"
            element={
              <ProtectedRoute allowedRoles={["seeker"]}>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seeker/licenses"
            element={
              <ProtectedRoute allowedRoles={["seeker"]}>
                <LicensesPage />
              </ProtectedRoute>
            }
          />
          
          {/* Poster Routes */}
          <Route
            path="/poster"
            element={
              <ProtectedRoute allowedRoles={["poster"]}>
                <PosterDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/poster/swipe/:jobId"
            element={
              <ProtectedRoute allowedRoles={["poster"]}>
                <SwipePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/poster/profile"
            element={
              <ProtectedRoute allowedRoles={["poster"]}>
                <ProfileBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/poster/jobs/new"
            element={
              <ProtectedRoute allowedRoles={["poster"]}>
                <JobFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/poster/jobs/:jobId/edit"
            element={
              <ProtectedRoute allowedRoles={["poster"]}>
                <JobFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/poster/verifications"
            element={
              <ProtectedRoute allowedRoles={["poster"]}>
                <VerificationAdminPage />
              </ProtectedRoute>
            }
          />
          
          {/* Shared Routes */}
          <Route
            path="/matches"
            element={
              <ProtectedRoute>
                <MatchesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/references"
            element={
              <ProtectedRoute>
                <ReferencesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bins/:binType"
            element={
              <ProtectedRoute>
                <SwipeBinsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <FeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviews"
            element={
              <ProtectedRoute>
                <InterviewsPage />
              </ProtectedRoute>
            }
          />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
