"use client";

import { logout } from "@/lib/client";
import Link from "next/link";

export function AppShell({
  title,
  eyebrow,
  children,
  nav,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  nav?: { href: string; label: string }[];
}) {
  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="mark">É</span>
          Elevate OS
        </Link>
        <div className="top-meta">
          <span className="eyebrow">{eyebrow}</span>
          {nav?.map((item) => (
            <Link key={item.href} href={item.href} className="ghost-link">
              {item.label}
            </Link>
          ))}
          <button type="button" className="ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="stage">
        <div className="stage-head">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
