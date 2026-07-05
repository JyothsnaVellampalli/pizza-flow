/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import StaffLoginPage from "./app/staff/login/page";
import StaffOrderPage from "./app/staff/order/page";
import AdminLoginPage from "./app/admin/login/page";
import AdminMenuPage from "./app/admin/menu/page";
import AdminDashboardPage from "./app/admin/dashboard/page";
import CustomerTablePage from "./app/table/[tableId]/page";
import SignupPage from "./app/signup/page";
import AuthConfirmPage from "./app/auth/confirm/page";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

// Client-side Session Guardian enforcing access privileges
function ProtectedRoute({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setIsAuthenticated(true);
            const { data: profile, error } = await supabase
              .from("profiles")
              .select("role, display_name")
              .eq("id", user.id)
              .maybeSingle();

            if (!error && profile) {
              const role = profile.role || "staff";
              if (role === "admin") {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
            } else {
              setIsAdmin(false);
            }
          } else {
            setIsAuthenticated(false);
            setIsAdmin(false);
          }
        } catch (err) {
          console.error("Auth check failed:", err);
          setIsAuthenticated(false);
          setIsAdmin(false);
        }
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
      setLoading(false);
    };

    checkAuth();
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FF6B2B]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/staff/order" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route redirecting to staff login */}
        <Route path="/" element={<Navigate to="/staff/login" replace />} />

        {/* Public Auth Routes */}
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/confirm" element={<AuthConfirmPage />} />
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Protected Staff Routes */}
        <Route
          path="/staff/order"
          element={
            <ProtectedRoute>
              <StaffOrderPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Routes */}
        <Route
          path="/admin/menu"
          element={
            <ProtectedRoute requireAdmin>
              <AdminMenuPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Customer Self-Ordering Placeholder Route */}
        <Route path="/table/:tableId" element={<CustomerTablePage />} />

        {/* Catch-all fallback redirect */}
        <Route path="*" element={<Navigate to="/staff/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

