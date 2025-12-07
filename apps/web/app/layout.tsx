import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "X Sentiments",
  description: "AI-powered probability tickers from X + Grok"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

