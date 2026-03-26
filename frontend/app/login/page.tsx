import { AuthForm } from "@features/auth/components/auth-form";

interface AuthPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getNextParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }

  return null;
}

export default function LoginPage({ searchParams }: AuthPageProps) {
  const nextPath = getNextParam(searchParams?.next);

  return (
    <div className="auth-page">
      <AuthForm mode="login" nextPath={nextPath} />
    </div>
  );
}
