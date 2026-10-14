import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PSI Savings Group",
  description:
    "Member savings, loan records, and group conversations for PSI Savings Group.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a className="psi-skip-link" href="#psi-content">
          Skip to content
        </a>

        <header className="psi-site-header">
          <div className="psi-site-header-inner">
            <Link
              href="/"
              className="psi-site-brand"
              aria-label="PSI Savings Group home"
            >
              <span
                className="psi-brand-mark"
                aria-hidden="true"
              >
                PSI
              </span>

              <span>
                <strong>PSI Savings Group</strong>

                <span className="psi-brand-subtitle">
                  Growing together
                </span>
              </span>
            </Link>

            <span className="psi-header-note">
              Community · Savings · Connection
            </span>
          </div>
        </header>

        <div
          id="psi-content"
          tabIndex={-1}
          className="psi-content"
        >
          {children}
        </div>
      </body>
    </html>
  );
}