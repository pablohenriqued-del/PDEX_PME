import { useEffect, useState } from "react";
import api, { formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ChevronDown, Check, Plus, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";

export default function TenantSwitcher() {
  const { user, switchTenant, isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [current, setCurrent] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ name: "", admin_email: "", admin_name: "", plan: "free" });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  const loadCurrent = () =>
    api.get("/tenant/me").then(({ data }) => setCurrent(data)).catch(() => {});
  const loadAll = () =>
    isSuperAdmin && api.get("/tenants").then(({ data }) => setTenants(data)).catch(() => {});

  useEffect(() => {
    loadCurrent();
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenant_id, isSuperAdmin]);

  const doSwitch = async (tid) => {
    if (tid === user?.tenant_id) return;
    try {
      await switchTenant(tid);
      toast.success("Empresa alternada");
      // Reload to refresh scoped data across the app
      setTimeout(() => window.location.reload(), 300);
    } catch (err) { toast.error(formatError(err)); }
  };

  const createTenant = async () => {
    setCreating(true);
    try {
      const { data } = await api.post("/tenants", form);
      setCreated({ email: data.user.email, password: data.generated_password, name: form.name });
      setForm({ name: "", admin_email: "", admin_name: "", plan: "free" });
      await loadAll();
      toast.success("Empresa criada");
    } catch (err) { toast.error(formatError(err)); }
    finally { setCreating(false); }
  };

  if (!current) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 hover:bg-white/5" data-testid="tenant-switcher-trigger">
            <Building2 className="w-4 h-4 text-cyan-300" strokeWidth={2} />
            <span className="text-sm font-semibold truncate max-w-[160px]">{current.name}</span>
            {isSuperAdmin && <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
          </Button>
        </DropdownMenuTrigger>
        {isSuperAdmin && (
          <DropdownMenuContent align="start" className="w-72 glass-strong border-white/10">
            <DropdownMenuLabel className="label-mono flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> SUPER-ADMIN · TROCAR EMPRESA
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tenants.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => doSwitch(t.id)}
                className="cursor-pointer"
                data-testid={`tenant-switch-${t.slug}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="mono text-[10px] text-muted-foreground">{t.slug} · {t.plan}</div>
                </div>
                {t.id === current.id && <Check className="w-4 h-4 text-emerald-400" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setOpenCreate(true)}
              className="cursor-pointer text-cyan-300"
              data-testid="tenant-create-button"
            >
              <Plus className="w-4 h-4 mr-2" /> Nova empresa
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>

      <Dialog open={openCreate} onOpenChange={(o) => { setOpenCreate(o); if (!o) setCreated(null); }}>
        <DialogContent className="glass-strong border-white/10 max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-xl">Nova empresa (tenant)</DialogTitle></DialogHeader>
          {created ? (
            <div className="space-y-3">
              <div className="text-sm">Empresa <strong>{created.name}</strong> criada. Credenciais do admin:</div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2 text-sm">
                <div><span className="label-mono">EMAIL</span>
                  <div className="mono flex items-center gap-2">
                    <span className="flex-1">{created.email}</span>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(created.email); toast.success("Copiado"); }}><Copy className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div><span className="label-mono">SENHA TEMPORÁRIA</span>
                  <div className="mono flex items-center gap-2">
                    <span className="flex-1">{created.password}</span>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(created.password); toast.success("Copiado"); }}><Copy className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
              <Button className="w-full gradient-brand text-white brand-glow" onClick={() => { setCreated(null); setOpenCreate(false); }}>Fechar</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label className="label-mono">NOME DA EMPRESA</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Corp" data-testid="new-tenant-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="label-mono">EMAIL DO ADMIN</Label>
                  <Input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} placeholder="admin@acme.com" data-testid="new-tenant-email" />
                </div>
                <div><Label className="label-mono">NOME DO ADMIN</Label>
                  <Input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} placeholder="Fulano de Tal" data-testid="new-tenant-admin-name" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Uma senha temporária será gerada e exibida logo após criar.</p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
                <Button
                  className="gradient-brand text-white brand-glow"
                  onClick={createTenant}
                  disabled={creating || !form.name || !form.admin_email || !form.admin_name}
                  data-testid="new-tenant-submit"
                >
                  {creating ? "Criando..." : "Criar empresa"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
