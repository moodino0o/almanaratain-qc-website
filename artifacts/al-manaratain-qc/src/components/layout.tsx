import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ClipboardList, LayoutDashboard, Settings, FileText, Beaker } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/records", label: "QC Register", icon: ClipboardList },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/settings", label: "Reference Data", icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex-shrink-0 flex flex-col print-hide">
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
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              QC
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Control Room</span>
              <span className="text-xs text-muted-foreground">Lab & Production</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="h-16 border-b border-border bg-card flex items-center justify-between px-8 shrink-0 print-hide">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
             <Beaker className="w-4 h-4" />
             Al Manaratain Quality Control System
          </div>
          <div className="flex items-center gap-4">
             <div className="text-xs text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-success"></span>
               System Operational
             </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 print-container">
          <div className="max-w-6xl mx-auto print-container h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
