// src/app/staff/login/page.tsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, ShieldAlert } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (isSupabaseConfigured && supabase) {
      try {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          throw error;
        }
        const { data: userData, error: userError } = await supabase.auth.getUser()
        console.log('getUser result:', userData, userError) 

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

        console.log('Profile fetch result, stafflogin:', profile, profileError)

        if (profileError) {
          console.error("Profile check failed:", profileError);
          await supabase.auth.signOut();
          throw new Error("Could not verify your account role. Please contact your administrator.");
        }

        const role = profile?.role; // will be 'staff' or 'admin' as a string

        if (role !== "staff" && role !== "admin") {
          await supabase.auth.signOut();
          throw new Error("Access Denied. You do not have staff or administrator permissions.");
        }

        setSuccessMsg("Logged in successfully via Supabase!");
        
        // Route based on role
        if (role === "admin") {
          setTimeout(() => navigate("/admin/dashboard"), 800);
        } else {
          setTimeout(() => navigate("/staff/order"), 800);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to sign in. Please verify credentials.");
        setLoading(false);
      }
    } else {
      setErrorMsg("Database offline: Supabase credentials are not configured. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
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
          <p className="text-[#9E9E9E] text-xs font-mono uppercase tracking-wider">New Ashok Nagar, Delhi | Staff Portal</p>
        </div>

        {/* Warning if Supabase is unconfigured */}
        {!isSupabaseConfigured && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-400 flex gap-2.5 items-start">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">Database Connection Required</p>
              <p className="leading-relaxed">This application is configured for production. Please define the following environment variables in your environment or Settings to enable secure cloud operations:</p>
              <p className="font-mono mt-1 text-[#FAFAFA] bg-[#1A1A1A]/50 p-1.5 rounded border border-red-500/10">
                VITE_SUPABASE_URL<br />
                VITE_SUPABASE_ANON_KEY
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-[#9E9E9E] block">Email Address</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9E9E]">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. staff@slicematic.com"
                className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#FF6B2B] transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono uppercase tracking-wider text-[#9E9E9E] block">Password</label>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9E9E]">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#FF6B2B] transition-colors"
              />
            </div>
          </div>

          {/* Errors/Success Notifications */}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF6B2B] hover:bg-[#E05A1F] text-white py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-[#333333] space-y-2">
          <p className="text-xs text-[#9E9E9E]">
            Authorized SliceMatic personnel only.
          </p>
          <p className="text-xs text-[#9E9E9E]">
            New staff? <Link to="/signup" className="text-[#FF6B2B] hover:underline font-bold">Register Account</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
