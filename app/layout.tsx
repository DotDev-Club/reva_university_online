import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "revauniversity.online — Reva University Study Resources",
  description: "Semester-specific notes, mock papers, and AI Q&A for Reva University students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Force light — no dark mode on this portal
    <html lang="en" className={geist.variable} style={{ colorScheme: 'light', background: '#F5F6FA' }}>
      <body style={{ background: '#F5F6FA', color: '#1F2937', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
