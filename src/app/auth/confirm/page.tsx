// src/app/auth/confirm/page.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, ShieldAlert, KeyRound, CheckCircle2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

export default function AuthConfirmPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const initSession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMsg("Database connection is not configured.");
        setCheckingSession(false);
        return;
      }

      try {
        // Supabase client automatically processes the hash/query parameters on load.
        // Let's retrieve the current session.
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
        }

        if (session && session.user) {
          setSessionActive(true);
          setEmail(session.user.email || "");
        } else {
          // Listen to onAuthStateChange in case the token is processed slightly later
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession && currentSession.user) {
              setSessionActive(true);
              setEmail(currentSession.user.email || "");
            }
          });

          // Wait a brief moment for any async token parsing
          await new Promise((resolve) => setTimeout(resolve, 800));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession && retrySession.user) {
            setSessionActive(true);
            setEmail(retrySession.user.email || "");
          }
          subscription.unsubscribe();
        }
      } catch (ex: any) {
        console.error("Error setting up session check:", ex);
      } finally {
        setCheckingSession(false);
      }
    };

    initSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg("Database offline.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // 1. Update the user's password in Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Could not update user password. Please try again.");
      }

      setSuccessMsg("Password updated successfully!");

      // Wait for session to be fully established
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Session not ready yet, use onAuthStateChange
        await new Promise<void>((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
              if (currentSession) {
                subscription.unsubscribe();
                resolve();
              }
            }
          );
        });
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError || !userData?.user) {
          setErrorMsg('Session error. Please try again.')
          setLoading(false)
          return
        }
        const userId = userData.user.id
        // Verify user has staff or admin role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle()

        console.log('Profile fetch result:', profile, profileError)

      console.log('profile fetch result:', profile, profileError);

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        setErrorMsg('Could not verify your account role. Please contact your administrator.');
        setLoading(false);
        return;
      }

      const role = profile?.role;  // will be 'staff' or 'admin' as a string

      if (role === "admin") {
        setTimeout(() => {
          navigate("/admin/dashboard");
        }, 1200);
      } else {
        setTimeout(() => {
          navigate("/staff/order");
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update password. Your invitation link may be expired.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-[#252525] border border-[#333333] rounded-2xl p-8 shadow-2xl space-y-6">
        
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FF6B2B]/10 text-[#FF6B2B] text-2xl font-serif font-extrabold border border-[#FF6B2B]/20">
            S
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#FAFAFA] tracking-tight">SliceMatic</h1>
          <p className="text-[#9E9E9E] text-xs font-mono uppercase tracking-wider">Activate Your Account</p>
        </div>

        {checkingSession ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FF6B2B]"></div>
            <p className="text-sm font-mono text-[#9E9E9E]">Verifying invitation session...</p>
          </div>
        ) : !sessionActive ? (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-400 flex gap-2.5 items-start">
              <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Invalid or Expired Invitation</p>
                <p className="leading-relaxed">
                  We couldn't detect an active invitation or password reset session. 
                  Please check your email link or contact your SliceMatic administrator for a new invitation.
                </p>
              </div>
            </div>
            <Link
              to="/staff/login"
              className="w-full bg-[#FF6B2B] hover:bg-[#E05A1F] text-white py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div className="bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 rounded-xl p-3.5 text-xs text-[#FF6B2B] flex gap-2.5 items-center">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#9E9E9E]">Confirming account for</p>
                <p className="font-bold text-[#FAFAFA]">{email}</p>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-[#9E9E9E] block">Choose Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9E9E]">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#FF6B2B] transition-colors"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-[#9E9E9E] block">Confirm Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9E9E]">
                  <KeyRound size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#FF6B2B] transition-colors"
                />
              </div>
            </div>

            {/* Inline Errors/Success Notifications */}
            {errorMsg && (
              <p className="text-[#FF3B30] text-xs font-mono text-center animate-pulse bg-[#FF3B30]/10 p-2.5 rounded-lg border border-[#FF3B30]/20">
                {errorMsg}
              </p>
            )}

            {successMsg && (
              <p className="text-[#4CAF50] text-xs font-mono text-center bg-[#4CAF50]/10 p-2.5 rounded-lg border border-[#4CAF50]/20">
                {successMsg}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B2B] hover:bg-[#E05A1F] text-white py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                "Activate Account"
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-4 border-t border-[#333333]">
          <p className="text-xs text-[#9E9E9E]">
            Already active?{" "}
            <Link to="/staff/login" className="text-[#FF6B2B] hover:underline font-bold">
              Sign In
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
