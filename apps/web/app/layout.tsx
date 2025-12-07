import "./globals.css";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "X Sentiments | AI-Powered Prediction Markets",
  description: "Real-time probability predictions powered by X and Grok AI"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container header-inner">
            <Link href="/" className="logo" style={{ textDecoration: "none" }}>
              <div className="logo-icon">📊</div>
              <span>X Sentiments</span>
            </Link>
            <nav style={{ display: "flex", gap: "24px" }}>
              <Link href="/markets" style={{ color: "var(--text-secondary)" }}>
                Markets
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
