import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { InternalShell } from "@/components/internal/shell";

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <InternalShell>{children}</InternalShell>
      </AuthProvider>
    </QueryProvider>
  );
}
