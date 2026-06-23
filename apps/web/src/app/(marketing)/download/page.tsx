import Link from "next/link";
import Image from "next/image";

export default function DownloadPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-73px)]">
      <main className="flex flex-col flex-1 items-center px-6 py-20 relative overflow-hidden">
        
        {/* Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-3xl relative z-10">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Install Proenpt
            </h1>
            <p className="text-lg text-zinc-400">
              Get the Chrome extension and start optimizing your workflow.
            </p>
          </div>

          <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl mb-12 text-center shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)]">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">How it works</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Once installed, click the floating orb in any ChatGPT, Claude, or Gemini conversation to instantly optimize your prompt before sending.
            </p>
          </div>

          <div className="space-y-6">
            
            {/* Step 1 */}
            <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl flex items-start gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-500/20">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Download the Extension</h3>
                <p className="text-zinc-400 mb-6">
                  Download the latest release of the Promptly Chrome extension.
                </p>
                <a 
                  href="#"
                  className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-medium hover:bg-zinc-200 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download .zip
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl flex items-start gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-lg border border-white/10">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Unzip the File</h3>
                <p className="text-zinc-400">
                  Extract the downloaded zip file to a folder on your computer. You'll need this folder in the next step.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl flex items-start gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-lg border border-white/10">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Open Chrome Extensions</h3>
                <p className="text-zinc-400">
                  Open Chrome and navigate to <code className="px-2 py-1 bg-black rounded-md text-blue-400">chrome://extensions</code>
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl flex items-start gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-lg border border-white/10">
                4
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Load Unpacked</h3>
                <p className="text-zinc-400">
                  Enable "Developer mode" in the top right, click "Load unpacked" in the top left, and select the folder you extracted in Step 2.
                </p>
              </div>
            </div>

          </div>

          <div className="mt-16 text-center">
            <Link 
              href="/dashboard"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Continue to Dashboard →
            </Link>
          </div>

        </div>
      </main>
    </div>
  )
}
