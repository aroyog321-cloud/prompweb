import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function MarketingNav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16 border-b border-white/[0.06]"
      style={{ background: "rgba(9,9,11,0.8)", backdropFilter: "blur(20px)" }}
    >
      <Link href="/" className="flex items-center gap-2">
        <div
          className="size-7 rounded-full flex items-center justify-center border border-white/10"
          style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
        />
        <span className="font-display font-semibold text-white text-[16px] tracking-tight">
          Promptly
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
        <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
        <Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
        <Link href="/download" className="hover:text-white transition-colors">Download</Link>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors hidden md:block">
          Sign in
        </Link>
        <Link
          href="/login"
          className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition-all hover:scale-[1.02]"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            boxShadow: "0 0 20px rgba(59,130,246,0.4)",
          }}
        >
          Get started →
        </Link>
      </div>
    </nav>
  );
}
