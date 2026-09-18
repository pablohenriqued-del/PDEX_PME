import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import {
  LayoutDashboard, Kanban, Package, Users, ShoppingCart, FileText,
  Settings, LogOut, ShieldCheck, Zap, Target, Boxes, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import NotificationBell from "@/components/NotificationBell";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/crm", label: "CRM Kanban", icon: Kanban, testId: "nav-crm" },
  { to: "/whatsapp", label: "Atendimento", icon: MessageSquare, testId: "nav-whatsapp" },
  { to: "/customers", label: "Clientes", icon: Users, testId: "nav-customers" },
  { to: "/products", label: "Catálogo", icon: Package, testId: "nav-products" },
  { to: "/inventory", label: "Inventário", icon: Boxes, testId: "nav-inventory" },
  { to: "/orders", label: "Pedidos", icon: ShoppingCart, testId: "nav-orders" },
  { to: "/goals", label: "Metas & Comissão", icon: Target, testId: "nav-goals" },
  { to: "/invoices", label: "Notas Fiscais", icon: FileText, testId: "nav-invoices" },
  { to: "/settings", label: "Configurações", icon: Settings, testId: "nav-settings" },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || "?").split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden lg:flex flex-col glass-strong border-r border-white/5">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-emerald flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <div className="font-display font-extrabold text-lg tracking-tight leading-none">NexusERP</div>
              <div className="label-mono mt-1">PME · Brasil</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testId}
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
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden glass-strong border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="font-display font-bold">NexusERP</div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={() => { logout(); navigate("/login"); }} data-testid="logout-button-mobile">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="hidden lg:flex items-center justify-end gap-2 px-6 py-3 border-b border-white/5">
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}
