import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Proenpt | Turn Good Prompts Into Expert Prompts",
  description: "Stop getting generic AI responses. Proenpt sits inside ChatGPT, Claude, and Gemini to automatically rewrite your prompts using expert-level frameworks, saving you hours of frustration.",
};

import { GlobalAuthSync } from "../components/GlobalAuthSync";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-promptly-cyan/30">
        {children}
        <GlobalAuthSync />
      </body>
    </html>
  );
}
