import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import {
  LayoutDashboard, Kanban, Package, Users, ShoppingCart, FileText,
  Settings, LogOut, ShieldCheck, Target, Boxes, MessageSquare, UserCircle, Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import NotificationBell from "@/components/NotificationBell";
import PdexLogo, { PdexMark, PdexWordmark } from "@/components/PdexLogo";
import TenantSwitcher from "@/components/TenantSwitcher";
import OnboardingWizard from "@/components/OnboardingWizard";

const ALL_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard", roles: ["admin", "vendedor", "contador"] },
  { to: "/crm", label: "CRM Kanban", icon: Kanban, testId: "nav-crm", roles: ["admin", "vendedor"] },
  { to: "/whatsapp", label: "Atendimento", icon: MessageSquare, testId: "nav-whatsapp", roles: ["admin", "vendedor"] },
  { to: "/customers", label: "Clientes", icon: Users, testId: "nav-customers", roles: ["admin", "vendedor"] },
  { to: "/products", label: "Catálogo", icon: Package, testId: "nav-products", roles: ["admin", "vendedor"] },
  { to: "/inventory", label: "Inventário", icon: Boxes, testId: "nav-inventory", roles: ["admin", "vendedor"] },
  { to: "/orders", label: "Pedidos", icon: ShoppingCart, testId: "nav-orders", roles: ["admin", "vendedor"] },
  { to: "/goals", label: "Metas & Comissão", icon: Target, testId: "nav-goals", roles: ["admin", "vendedor"] },
  { to: "/invoices", label: "Notas Fiscais", icon: FileText, testId: "nav-invoices", roles: ["admin", "vendedor", "contador"] },
  { to: "/audit", label: "Auditoria", icon: ShieldCheck, testId: "nav-audit", roles: ["admin", "contador"] },
  { to: "/settings", label: "Configurações", icon: Settings, testId: "nav-settings", roles: ["admin", "contador"] },
  { to: "/profile", label: "Minha Conta", icon: UserCircle, testId: "nav-profile", roles: ["admin", "vendedor", "contador"] },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (user?.name || "?").split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const role = user?.role || "vendedor";
  const NAV = ALL_NAV.filter((n) => n.roles.includes(role));
  const isContador = role === "contador";

  const SidebarBody = ({ onNavigate }) => (
    <>
      <div className="p-6 border-b border-white/5">
        <PdexLogo size={36} compact tagline="PME · ERP · SEM LIMITES" />
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            data-testid={n.testId}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <n.icon className="w-4 h-4" strokeWidth={1.75} />
            <span className="font-medium">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-9 h-9 border border-white/10">
            <AvatarFallback className="bg-emerald-500/10 text-emerald-300 text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name}</div>
            <div className="flex items-center gap-1.5">
              {isAdmin ? (
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-[10px] px-1.5 py-0" data-testid="role-badge">
                  <ShieldCheck className="w-3 h-3 mr-1" strokeWidth={1.75} />ADMIN
                </Badge>
              ) : isContador ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] px-1.5 py-0" data-testid="role-badge">
                  CONTADOR
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px] px-1.5 py-0" data-testid="role-badge">
                  VENDEDOR
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          onClick={() => { logout(); navigate("/login"); }}
          data-testid="logout-button"
        >
          <LogOut className="w-4 h-4 mr-2" strokeWidth={1.75} />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="w-64 shrink-0 hidden lg:flex flex-col glass-strong border-r border-white/5">
        <SidebarBody />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden glass-strong border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2" data-testid="mobile-menu-button" aria-label="Abrir menu">
                  <Menu className="w-5 h-5" strokeWidth={2} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col glass-strong border-r border-white/10" data-testid="mobile-menu-sheet">
                <SidebarBody onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <PdexMark size={28} />
            <PdexWordmark height={18} />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
          </div>
        </div>

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-between gap-2 px-6 py-3 border-b border-white/5">
          <TenantSwitcher />
          <NotificationBell />
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <OnboardingWizard />
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}
