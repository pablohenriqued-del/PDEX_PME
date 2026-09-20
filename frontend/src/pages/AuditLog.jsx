import { useEffect, useState } from "react";
import api, { formatError, formatDateTime } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

const ACTION_COLORS = {
  create: "border-emerald-500/40 text-emerald-300",
  update: "border-cyan-500/40 text-cyan-300",
  delete: "border-rose-500/40 text-rose-300",
  switch: "border-violet-500/40 text-violet-300",
  invite: "border-blue-500/40 text-blue-300",
  anonymize: "border-amber-500/40 text-amber-300",
  login: "border-slate-500/40 text-slate-300",
  change_password: "border-fuchsia-500/40 text-fuchsia-300",
};

const RESOURCE_OPTS = ["all", "lead", "customer", "order", "product", "user", "tenant", "session"];
const ACTION_OPTS = ["all", "create", "update", "delete", "switch", "invite", "anonymize", "login", "change_password"];

export default function AuditLog() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resource, setResource] = useState("all");
  const [action, setAction] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (resource !== "all") params.resource_type = resource;
      if (action !== "all") params.action = action;
      const { data } = await api.get("/audit", { params });
      setRows(data);
    } catch (err) { toast.error(formatError(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resource, action]);

  return (
    <div className="p-6 lg:p-10 space-y-6" data-testid="audit-page">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="label-mono flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-cyan-300" strokeWidth={2.25} /> LGPD · SOC-2 · AUDITORIA
          </div>
          <h1 className="font-display font-extrabold text-4xl tracking-tight mt-1">Log de auditoria</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isSuperAdmin ? "Todas as ações relevantes em todos os tenants." : "Ações relevantes na sua empresa."}
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="audit-refresh">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="label-mono">RECURSO</span>
          <Select value={resource} onValueChange={setResource}>
            <SelectTrigger className="flex-1" data-testid="audit-resource-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESOURCE_OPTS.map((r) => <SelectItem key={r} value={r}>{r === "all" ? "Todos" : r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-mono">AÇÃO</span>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="flex-1" data-testid="audit-action-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_OPTS.map((a) => <SelectItem key={a} value={a}>{a === "all" ? "Todas" : a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 justify-end text-sm text-muted-foreground">
          <Search className="w-4 h-4" /> {rows.length} eventos exibidos
        </div>
      </div>

      <Card className="glass border-white/5 overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead>
              <tr className="text-left label-mono border-b border-white/5">
                <th className="p-3">QUANDO</th>
                <th className="p-3">QUEM</th>
                <th className="p-3">AÇÃO</th>
                <th className="p-3">RECURSO</th>
                <th className="p-3">RESUMO</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum evento — realize ações no sistema e volte aqui.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`audit-row-${r.id}`}>
                  <td className="p-3 mono text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td className="p-3">
                    <div className="text-sm">{r.actor_email || "—"}</div>
                    <div className="mono text-[10px] text-muted-foreground">{r.actor_role || "sistema"}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={ACTION_COLORS[r.action] || "border-slate-500/40 text-slate-300"}>
                      {r.action.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="text-sm capitalize">{r.resource_type}</div>
                    {r.resource_id && <div className="mono text-[10px] text-muted-foreground truncate max-w-[120px]">{r.resource_id.slice(0, 8)}</div>}
                  </td>
                  <td className="p-3 text-sm">{r.summary || "-"}</td>
                  <td className="p-3 mono text-xs text-muted-foreground">{r.ip_address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
