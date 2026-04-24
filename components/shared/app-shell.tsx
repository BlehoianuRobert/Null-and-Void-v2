import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
};

export function AppShell({
  title,
  roleLabel,
  nav,
  topRight,
  children,
}: {
  title: string;
  roleLabel: string;
  nav: NavItem[];
  topRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-50">
      <div className="flex min-h-screen w-full gap-0">
        <aside className="hidden w-72 shrink-0 border-r border-slate-900 bg-slate-950/60 px-4 py-6 md:block">
          <div className="px-2">
            <div className="text-xs font-semibold tracking-wide text-[#1D9E75]">{title}</div>
            <div className="mt-1 text-sm text-slate-400">{roleLabel}</div>
          </div>

          <nav className="mt-8 space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60 hover:text-slate-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 border-t border-slate-900 pt-4">{topRight}</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <div className="text-xs font-semibold tracking-wide text-[#1D9E75]">{title}</div>
                <div className="text-xs text-slate-400">{roleLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">{topRight}</div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

