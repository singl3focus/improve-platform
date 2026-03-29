import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { GlobalUiControls } from "@shared/ui/global-ui-controls";
import { AppQueryProvider } from "@shared/providers/app-query-provider";
import { UserPreferencesProvider } from "@shared/providers/user-preferences-provider";
import "./globals.css";
import "./editorial-overrides.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Improve Platform",
  description: "Personal learning platform MVP frontend."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${cormorant.variable}`}>
        <UserPreferencesProvider>
          <AppQueryProvider>
            <GlobalUiControls />
            {children}
          </AppQueryProvider>
        </UserPreferencesProvider>
      </body>
    </html>
  );
}
