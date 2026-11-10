"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Ringkasan" },
  { href: "/transaksi", label: "Transaksi" },
  { href: "/laporan", label: "Laporan" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigasi utama">
      {/* Desktop: tab atas */}
      <div className="hidden sm:flex gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={
              "rounded-md px-3 py-1.5 text-sm transition-colors " +
              (isActive(pathname, item.href)
                ? "bg-ink text-bg font-medium"
                : "text-ink-soft hover:text-ink")
            }
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Mobile: nav bawah */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={
                "flex-1 py-3.5 text-center text-[13px] border-b-2 transition-colors " +
                (isActive(pathname, item.href)
                  ? "border-ink text-ink font-medium"
                  : "border-transparent text-ink-soft")
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
