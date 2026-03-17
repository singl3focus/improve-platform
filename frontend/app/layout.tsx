import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { GlobalUiControls } from "@/components/layout/global-ui-controls";
import { AppQueryProvider } from "@/components/providers/app-query-provider";
import { UserPreferencesProvider } from "@/components/providers/user-preferences-provider";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
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
      <body className={montserrat.className}>
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
