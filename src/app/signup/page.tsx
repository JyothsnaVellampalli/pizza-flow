// src/app/signup/page.tsx
import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-[#252525] border border-[#333333] rounded-2xl p-8 shadow-2xl space-y-6 text-center">
        
        {/* Logo / Header */}
        <div className="space-y-2 relative">
          <Link 
            to="/staff/login" 
            className="absolute left-0 top-1 text-[#9E9E9E] hover:text-[#FAFAFA] transition-colors p-1"
            title="Back to Login"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FF6B2B]/10 text-[#FF6B2B] text-2xl font-serif font-extrabold border border-[#FF6B2B]/20">
            S
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#FAFAFA] tracking-tight">SliceMatic</h1>
          <p className="text-[#9E9E9E] text-xs font-mono uppercase tracking-wider">Access Control</p>
        </div>

        {/* Invitation Only Warning Card */}
        <div className="bg-[#FF6B2B]/5 border border-[#FF6B2B]/20 rounded-xl p-6 space-y-4 flex flex-col items-center">
          <div className="p-3 bg-[#FF6B2B]/10 rounded-full text-[#FF6B2B] border border-[#FF6B2B]/20">
            <ShieldAlert size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-serif font-bold text-[#FAFAFA]">Invitation Required</h2>
            <p className="text-sm text-[#9E9E9E] leading-relaxed">
              Account creation is by invitation only. Contact your SliceMatic administrator.
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="pt-2">
          <Link
            to="/staff/login"
            className="inline-flex items-center justify-center w-full bg-[#FF6B2B] hover:bg-[#E05A1F] text-white py-3 px-4 rounded-xl font-bold transition-all text-sm cursor-pointer"
          >
            Back to Login
          </Link>
        </div>

      </div>
    </div>
  );
}
