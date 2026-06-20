export function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-6 md:px-10 py-12 bg-[#09090b]">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="size-6 rounded-full border border-white/10 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
            />
            <span className="font-display text-sm font-semibold text-white">
              Promptly
            </span>
          </div>
          <p className="text-xs text-zinc-600 max-w-xs">
            The intelligent prompt engineering overlay for Chrome.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 text-sm">
          {[
            { head: "Product",    links: ["Features", "Pricing", "Changelog", "Roadmap"] },
            { head: "Extension",  links: ["Download", "Documentation", "Permissions", "Status"] },
            { head: "Company",    links: ["About", "Blog", "Careers", "Legal"] },
          ].map((col) => (
            <div key={col.head}>
              <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">{col.head}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a className="text-zinc-600 hover:text-zinc-300 transition-colors text-sm cursor-pointer">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-2">
        <p className="text-xs text-zinc-700">© 2026 Promptly AI. All rights reserved.</p>
        <p className="text-xs text-zinc-700">
          Status: <span className="text-green-500">All systems operational</span>
        </p>
      </div>
    </footer>
  );
}
