import { useEffect, useState } from "react";
import api, { API_BASE, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Zap, Webhook, ShieldCheck, Copy, UserPlus, Users } from "lucide-react";

export default function Settings() {
  const { isAdmin } = useAuth();
  const [wa, setWa] = useState({ configured: false });
  const [users, setUsers] = useState([]);
  const [openUser, setOpenUser] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "vendedor" });

  useEffect(() => {
    api.get("/whatsapp/status").then(({ data }) => setWa(data));
    if (isAdmin) api.get("/auth/users").then(({ data }) => setUsers(data));
  }, [isAdmin]);

  const webhookUrl = `${API_BASE}/whatsapp/webhook?token=nexus_webhook_secret_2026`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada");
  };

  const createUser = async () => {
    try {
      await api.post("/auth/register", form);
      setOpenUser(false);
      setForm({ email: "", password: "", name: "", role: "vendedor" });
      api.get("/auth/users").then(({ data }) => setUsers(data));
      toast.success("Usuário criado");
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="settings-page">
      <div>
        <div className="label-mono">ADMINISTRAÇÃO · CONFIGURAÇÕES</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Integrações, usuários e conformidade.</p>
      </div>

      <Card className="glass border-white/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg gradient-emerald flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Integração WhatsApp — Evolution API</div>
              <div className="label-mono flex items-center gap-2">
                {wa.configured ? (
                  <><span className="status-dot text-emerald-400 pulse-dot" /> CONECTADO · {wa.instance}</>
                ) : (
                  <><span className="status-dot text-amber-400 pulse-dot" /> MODO DEMO · MOCKADO</>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/60 border border-white/5 p-4 space-y-3">
            <div className="label-mono flex items-center gap-2"><Webhook className="w-3 h-3" strokeWidth={2} /> URL DO WEBHOOK</div>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="mono text-xs bg-slate-950/60" data-testid="webhook-url" />
              <Button variant="outline" onClick={copyWebhook} data-testid="copy-webhook"><Copy className="w-4 h-4" strokeWidth={1.75} /></Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Aponte o webhook <span className="mono text-emerald-300">messages.upsert</span> da sua instância Evolution para essa URL.
              Novas mensagens criam leads automaticamente na coluna Novo.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-slate-900/60 border border-white/5 p-4">
              <div className="label-mono mb-2">EVOLUTION_API_URL</div>
              <div className="mono text-muted-foreground text-[11px]">Ex.: https://evo.suaempresa.com</div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-white/5 p-4">
              <div className="label-mono mb-2">EVOLUTION_API_KEY</div>
              <div className="mono text-muted-foreground text-[11px]">Global API Key do painel</div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-white/5 p-4">
              <div className="label-mono mb-2">EVOLUTION_INSTANCE</div>
              <div className="mono text-muted-foreground text-[11px]">Nome da instância</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Configure essas variáveis no <span className="mono">/app/backend/.env</span> (ou via Coolify em produção)
            e reinicie o backend. Sem elas, o envio de mensagens fica em modo simulado.
          </p>
        </CardContent>
      </Card>

      <Card className="glass border-white/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg gradient-indigo flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Motor Fiscal</div>
              <div className="label-mono">MOCK · CONFIGURÁVEL POR .ENV</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { name: "ICMS", key: "FISCAL_ICMS_RATE", def: "18%" },
              { name: "PIS", key: "FISCAL_PIS_RATE", def: "1,65%" },
              { name: "COFINS", key: "FISCAL_COFINS_RATE", def: "7,6%" },
              { name: "ISS", key: "FISCAL_ISS_RATE", def: "5%" },
              { name: "IPI", key: "FISCAL_IPI_RATE", def: "5%" },
            ].map((t) => (
              <div key={t.name} className="rounded-lg bg-slate-900/60 border border-white/5 p-4 text-center">
                <div className="label-mono">{t.name}</div>
                <div className="font-display text-lg font-bold text-emerald-300 mt-1">{t.def}</div>
                <div className="text-[10px] text-muted-foreground mono mt-1">{t.key}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Substitua o motor mock por um provedor real (Focus NFe / devnota / Nfe.io) editando <span className="mono">/app/backend/fiscal.py</span>.
            Sempre valide CFOP, CST e regime tributário com o contador.
          </p>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="glass border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-300" strokeWidth={2} />
                </div>
                <div>
                  <div className="font-display font-bold text-lg">Usuários & Perfis</div>
                  <div className="label-mono">RBAC · ADMIN E VENDEDORES</div>
                </div>
              </div>
              <Button className="gradient-emerald text-white" onClick={() => setOpenUser(true)} data-testid="new-user-button">
                <UserPlus className="w-4 h-4 mr-2" strokeWidth={2} /> Novo Usuário
              </Button>
            </div>
            <table className="w-full text-sm" data-testid="users-table">
              <thead>
                <tr className="text-left label-mono border-b border-white/5">
                  <th className="p-3">NOME</th>
                  <th className="p-3">EMAIL</th>
                  <th className="p-3">PERFIL</th>
                  <th className="p-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3 mono text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={u.role === "admin" ? "border-indigo-500/40 text-indigo-300" : "border-emerald-500/40 text-emerald-300"}>
                        {u.role === "admin" ? "ADMIN" : "VENDEDOR"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {u.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">ATIVO</Badge>
                      ) : (
                        <Badge variant="outline">INATIVO</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={openUser} onOpenChange={setOpenUser}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="label-mono">NOME</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" /></div>
            <div><Label className="label-mono">EMAIL</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" /></div>
            <div><Label className="label-mono">SENHA</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input" /></div>
            <div><Label className="label-mono">PERFIL</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenUser(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={createUser} disabled={!form.email || !form.password || !form.name} data-testid="save-user-button">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
