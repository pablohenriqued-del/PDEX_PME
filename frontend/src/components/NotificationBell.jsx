import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, RefreshCw, Trophy, MessageSquare, Info, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const ICONS = {
  stock_alert: AlertTriangle,
  marketplace_sync: RefreshCw,
  commission: Trophy,
  whatsapp: MessageSquare,
  info: Info,
};

const TONES = {
  stock_alert: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  marketplace_sync: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  commission: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  whatsapp: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  info: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [c, list] = await Promise.all([
        api.get("/notifications/unread_count"),
        api.get("/notifications", { params: { unread: false } }),
      ]);
      setCount(c.data.count);
      setItems(list.data);
    } catch {}
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const markRead = async (id, link) => {
    try { await api.post(`/notifications/${id}/read`); } catch {}
    load();
    if (link) { setOpen(false); navigate(link); }
  };
  const markAllRead = async () => {
    await api.post("/notifications/mark_all_read");
    load();
    toast.success("Todas marcadas como lidas");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" data-testid="notifications-bell">
          <Bell className="w-5 h-5" strokeWidth={1.75} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-1 pulse-dot" data-testid="notifications-badge">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] glass-strong border-white/10 p-0" align="end" data-testid="notifications-popover">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div>
            <div className="font-display font-bold">Notificações</div>
            <div className="label-mono">{count} não lidas · últimas 100</div>
          </div>
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs" data-testid="mark-all-read">
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[440px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação.</div>
          ) : items.map((n) => {
            const Icon = ICONS[n.type] || Info;
            return (
              <button
                key={n.id}
                onClick={() => markRead(n.id, n.link)}
                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/[0.03] flex gap-3 ${!n.read ? "bg-emerald-500/[0.03]" : ""}`}
                data-testid={`notification-${n.id}`}
              >
                <div className={`w-8 h-8 rounded-lg border flex-shrink-0 flex items-center justify-center ${TONES[n.type] || TONES.info}`}>
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="text-sm font-medium truncate flex-1">{n.title}</div>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />}
                  </div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] mono text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
