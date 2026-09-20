import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { LayoutDashboard, Kanban, ShoppingCart, Bell, Menu } from "lucide-react";

/**
 * Fixed bottom navigation for mobile (<lg).
 * - 3 primary shortcuts (Dashboard, CRM, Pedidos)
 * - Bell with unread count badge (routes to /dashboard where notifications live at the top)
 * - Menu opens the mobile drawer via a callback the parent Layout passes
 */
export default function MobileBottomNav({ onOpenMenu }) {
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const load = () =>
      api.get("/notifications/unread_count").then(({ data }) => setUnread(data.count || 0)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const items = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard, testId: "bottomnav-dashboard" },
    { to: "/crm", label: "CRM", icon: Kanban, testId: "bottomnav-crm" },
    { to: "/orders", label: "Pedidos", icon: ShoppingCart, testId: "bottomnav-orders" },
  ];

  const active = (to) => pathname.startsWith(to);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      data-testid="mobile-bottom-nav"
    >
      <div className="grid grid-cols-5 items-stretch">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            data-testid={it.testId}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-cyan-300" : "text-muted-foreground hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative ${isActive ? "" : ""}`}>
                  <it.icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
                  {isActive && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full gradient-brand brand-glow" />
                  )}
                </div>
                <span className="tracking-wider uppercase">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Sino */}
        <button
          type="button"
          onClick={() => navigate("/dashboard#notif")}
          data-testid="bottomnav-bell"
          className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
            unread > 0 ? "text-cyan-300" : "text-muted-foreground hover:text-white"
          }`}
        >
          <div className="relative">
            <Bell className="w-5 h-5" strokeWidth={unread > 0 ? 2.25 : 1.75} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5 pulse-dot">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          <span className="tracking-wider uppercase">Sino</span>
        </button>

        {/* Menu (opens drawer) */}
        <button
          type="button"
          onClick={onOpenMenu}
          data-testid="bottomnav-menu"
          className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
          <span className="tracking-wider uppercase">Menu</span>
        </button>
      </div>
    </nav>
  );
}
