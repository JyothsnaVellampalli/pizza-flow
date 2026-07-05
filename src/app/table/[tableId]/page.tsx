// src/app/table/[tableId]/page.tsx
import { useParams, Link } from "react-router-dom";
import { Pizza, MessageSquareCode, Sparkles } from "lucide-react";

export default function CustomerTablePage() {
  const { tableId } = useParams<{ tableId: string }>();

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#FAFAFA] flex flex-col justify-center items-center p-6 text-center">
      <div className="max-w-md w-full bg-[#252525] border border-[#333333] rounded-2xl p-8 shadow-2xl space-y-6">
        
        {/* Animated Branded Logo Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FF6B2B]/10 text-[#FF6B2B] border border-[#FF6B2B]/20 animate-pulse">
            <Pizza size={32} className="rotate-45" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">SliceMatic Delhi</h1>
          <p className="text-xs font-mono uppercase tracking-wider text-[#9E9E9E]">New Ashok Nagar Outlet</p>
        </div>

        {/* Dynamic Table Indicator Badge */}
        {tableId && (
          <div className="inline-block bg-[#FF6B2B]/20 border border-[#FF6B2B]/40 px-4 py-1.5 rounded-full">
            <span className="text-sm font-bold font-mono text-[#FF6B2B] uppercase tracking-wider">
              📍 Table {tableId} Assigned
            </span>
          </div>
        )}

        {/* Friendly Redirect Message */}
        <div className="space-y-2 border-t border-b border-[#333333] py-6 my-2">
          <MessageSquareCode size={28} className="mx-auto text-neutral-500 mb-2" />
          <h2 className="text-lg font-serif font-semibold text-[#FAFAFA]">Please Order at the Counter</h2>
          <p className="text-xs text-[#9E9E9E] leading-relaxed max-w-sm mx-auto font-sans">
            We are currently transitioning from paper forms to digital terminals! 
            To customize and place your pizza order, please proceed to the cash counter and tell staff your table number: 
            <span className="text-[#FF6B2B] font-bold font-mono"> Table {tableId || "1"}</span>.
          </p>
        </div>

        {/* Future QR Code note */}
        <div className="bg-[#1A1A1A] p-4 rounded-xl border border-neutral-800/80 text-xs text-[#9E9E9E] flex items-center gap-2 justify-center">
          <Sparkles size={14} className="text-[#FF6B2B] flex-shrink-0" />
          <span className="font-mono text-[10px] tracking-wide">Customer QR-ordering coming soon!</span>
        </div>

        {/* Staff shortcut navigation */}
        <div className="pt-4 border-t border-[#333333] flex justify-center gap-4 text-xs font-mono">
          <Link to="/staff/login" className="text-[#9E9E9E] hover:text-[#FF6B2B] transition-colors">
            Staff Portal
          </Link>
          <span className="text-neutral-700">|</span>
          <Link to="/admin/dashboard" className="text-[#9E9E9E] hover:text-[#FF6B2B] transition-colors">
            Admin Metrics
          </Link>
        </div>

      </div>
    </div>
  );
}
