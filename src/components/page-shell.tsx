import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

/**
 * Kerangka halaman bersama: header + nav desktop.
 * Tanpa JS tambahan — ThemeToggle dan MainNav tetap satu-satunya client component.
 */
export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 sm:max-w-3xl sm:px-6">
      <header className="flex items-center justify-between pb-3 pt-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="truncate text-[13px] text-ink-soft">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-4">
          <MainNav />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 pb-28 sm:pb-12">{children}</main>
    </div>
  );
}

/** Wadah konten utama dengan garis atas konsisten. */
export function Bagian({
  title,
  aksi,
  children,
  className,
}: {
  title: string;
  aksi?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={"border-t border-line pt-5" + (className ? " " + className : "")}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aksi}
      </div>
      {children}
    </section>
  );
}
