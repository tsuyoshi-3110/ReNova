// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import React, { Suspense } from "react";

import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "ReNova",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider>
          <AuthProvider>
            <Navbar />

            {/* ✅ useSearchParams を使う AuthGate は Suspense 配下にする */}
            <Suspense fallback={null}>
              <AuthGate>{children}</AuthGate>
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
