import Link from "next/link";
import { requireProfile } from "@/lib/auth/get-profile";
import { LogoutButton } from "@/components/auth/logout-button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/ventas", label: "Ventas" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  operador: "Operador",
  lector: "Lector",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold tracking-tight">ATS Gestión</span>
            <nav className="flex gap-4 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-600 hover:text-black"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              {profile.full_name ?? "Usuario"} ·{" "}
              <span className="font-medium text-gray-700">
                {ROLE_LABELS[profile.role]}
              </span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
