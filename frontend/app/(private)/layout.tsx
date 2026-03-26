import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PrivateShell } from "@shared/ui/private-shell";
import { REFRESH_TOKEN_COOKIE } from "@features/auth/lib/session";
import { hasValidServerSession } from "@features/auth/lib/server-session";

export default async function PrivateLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const hasSession = await hasValidServerSession(refreshToken);

  if (!hasSession) {
    redirect("/login");
  }

  return <PrivateShell>{children}</PrivateShell>;
}
