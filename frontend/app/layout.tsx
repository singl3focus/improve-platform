import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppQueryProvider } from "@/components/providers/app-query-provider";
import { UserPreferencesProvider } from "@/components/providers/user-preferences-provider";
import "./globals.css";

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
      <body>
        <UserPreferencesProvider>
          <AppQueryProvider>{children}</AppQueryProvider>
        </UserPreferencesProvider>
      </body>
    </html>
  );
}
