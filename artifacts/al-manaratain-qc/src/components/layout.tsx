import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  ClipboardList,
  LayoutDashboard,
  Settings,
  FileText,
  Beaker,
  Archive,
  FileCheck2,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, role, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/records", label: "QC Register", icon: ClipboardList },
    ...(role === "technician" ? [] : [{ href: "/complaints", label: "Complaints", icon: FileWarning }]),
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/archive", label: "Archive", icon: Archive },
    { href: "/standards", label: "Standards", icon: FileCheck2 },
    ...(role === "administrator"
      ? [{ href: "/settings", label: "Settings", icon: Settings }]
      : []),
  ];

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border bg-card print-hide md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/">
            <img
              src="/al-manaratain-logo.webp"
              alt="Al Manaratain"
              className="h-8 object-contain cursor-pointer"
            />
          </Link>
        </div>

        <div className="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Quality Control
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "E").toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="truncate text-sm font-medium">
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                  "Registered employee"}
              </span>
              <span className="max-w-[170px] truncate text-xs text-muted-foreground">
                {user?.email ?? "Employee account"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full rounded-md px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-8 print-hide">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
            <Beaker className="w-4 h-4" />
            <span className="truncate">
              Al Manaratain Quality Control System
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              <span className="hidden sm:inline">System Operational</span>
            </div>
          </div>
        </div>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 print-hide md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print-container">
          <div className="mx-auto h-full w-full max-w-6xl min-w-0 print-container">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
