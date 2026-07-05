// src/app/staff/order/page.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, Pizza, User } from "lucide-react";
import OrderWizard from "../../../components/OrderWizard";
import { supabase } from "../../../lib/supabase";

export default function StaffOrderPage() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<{ email: string; name: string; role: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/staff/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, display_name")
          .eq("id", user.id)
          .maybeSingle();

        setStaff({
          email: user.email || "",
          name: profile?.display_name || user.user_metadata?.name || "SliceMatic Personnel",
          role: profile?.role || "staff"
        });
      } catch (e) {
        console.error("Failed to check auth session", e);
        navigate("/staff/login");
      } finally {
        setCheckingAuth(false);
      }
    };
    checkUser();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Signout error:", e);
    }
    navigate("/staff/login");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#FF6B2B]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col text-[#FAFAFA]">
      {/* NAVIGATION BAR */}
      <nav className="bg-[#252525] border-b border-white/10 px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <Link to="/staff/order" className="flex items-center gap-2.5">
          <div className="bg-[#FF6B2B] p-2 rounded-xl text-white">
            <Pizza size={22} className="rotate-45" />
          </div>
          <div>
            <span className="font-serif font-extrabold text-xl tracking-tight block text-white">
              SliceMatic <span className="text-[#FF6B2B]">Flow</span>
            </span>
          </div>
        </Link>

        {/* Staff details and actions */}
        <div className="flex items-center gap-6 text-sm">
          {staff?.role === "admin" ? (
            <Link 
              to="/admin/dashboard" 
              className="text-[#9E9E9E] hover:text-[#FF6B2B] font-medium transition-colors"
              id="admin-dashboard-link"
            >
              Admin Dashboard
            </Link>
          ) : (
            <span 
              className="text-[#555555] cursor-not-allowed font-medium select-none"
              title="Admin access required to access dashboard"
              id="admin-dashboard-link-disabled"
            >
              Admin Dashboard
            </span>
          )}
          <div className="flex items-center gap-2 border-l border-white/10 pl-6">
            <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#FF6B2B] border border-white/5">
              <User size={16} />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs text-[#9E9E9E] font-mono leading-none">Logged in as</p>
              <p className="font-bold text-xs text-[#FAFAFA]">{staff?.email || "Counter Staff"}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="ml-2 text-[#9E9E9E] hover:text-[#FF3B30] p-1.5 rounded-lg hover:bg-red-500/10 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow p-4 md:p-8 flex flex-col justify-center space-y-12">
        <div className="max-w-5xl mx-auto w-full">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-bold text-[#FAFAFA] tracking-tight">Counter Order Terminal</h1>
              <p className="text-[#9E9E9E] text-sm">Create and print order tickets instantly for counter sales.</p>
            </div>
          </div>

          <OrderWizard source="staff" />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#252525] border-t border-white/5 py-4 text-center text-xs text-[#9E9E9E] font-mono">
        &copy; {new Date().getFullYear()} SliceMatic Delhi. Built for FDE Programme Batch C2.
      </footer>
    </div>
  );
}
