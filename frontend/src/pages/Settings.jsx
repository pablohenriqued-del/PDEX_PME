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
import { Zap, Webhook, ShieldCheck, Copy, UserPlus, Users, Sparkles, Building2, Mail } from "lucide-react";

export default function Settings() {
  const { isAdmin } = useAuth();
  const [wa, setWa] = useState({ configured: false });
  const [regime, setRegime] = useState(null);
  const [users, setUsers] = useState([]);
  const [openUser, setOpenUser] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "vendedor" });
  const [tenant, setTenant] = useState(null);
  const [tenantEdit, setTenantEdit] = useState("");
  const [invite, setInvite] = useState(null); // {email, password} from response

  const loadRegime = () => api.get("/dashboard/fiscal_regime").then(({ data }) => setRegime(data));
  const loadMembers = () => api.get("/tenant/members").then(({ data }) => setUsers(data));
  const loadTenant = () => api.get("/tenant/me").then(({ data }) => { setTenant(data); setTenantEdit(data.name); }).catch(() => {});

  useEffect(() => {
    api.get("/whatsapp/status").then(({ data }) => setWa(data));
    loadRegime();
    loadTenant();
    if (isAdmin) loadMembers();
  }, [isAdmin]);

  const changeRegime = async (mode) => {
    try {
      await api.post(`/dashboard/fiscal_regime?mode=${mode}`);
      await loadRegime();
      toast.success(`Regime alterado: ${mode.toUpperCase()}`);
    } catch (err) { toast.error(formatError(err)); }
  };

  const webhookUrl = `${API_BASE}/whatsapp/webhook?token=pdex_webhook_secret_2026`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada");
  };

  const saveTenant = async () => {
    try {
      const { data } = await api.patch("/tenant/me", { name: tenantEdit });
      setTenant(data);
      toast.success("Empresa atualizada");
    } catch (err) { toast.error(formatError(err)); }
  };

  const inviteMember = async () => {
    try {
      const { data } = await api.post("/tenant/invite", form);
      setInvite({ email: data.user.email, password: data.generated_password });
      setForm({ email: "", name: "", role: "vendedor" });
      setOpenUser(false);
      loadMembers();
      toast.success("Convite criado — copie a senha temporária abaixo");
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
              <Sparkles className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Regime Fiscal · Reforma Tributária 2027</div>
              <div className="label-mono">CBS + IBS · MOCK · SIMULA LC 214/2025</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            A partir de 2027 o sistema tributário brasileiro passa a ter <strong>CBS</strong> (federal, ~8,8%) + <strong>IBS</strong> (estadual/municipal, ~17,7%) substituindo ICMS/ISS/PIS/COFINS/IPI.
            Escolha entre <strong>Classic</strong> (pré-reforma), <strong>Transição</strong> (2027-2032, alíquotas híbridas) ou <strong>Reforma 2027</strong> (novo IVA dual).
            A mudança impacta imediatamente novas emissões de nota. Persistir em <span className="mono">.env FISCAL_MODE</span> após reiniciar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { mode: "classic", label: "Classic", desc: "Pré-reforma. ICMS/PIS/COFINS/ISS/IPI." },
              { mode: "hybrid", label: "Transição", desc: "50% classic + 50% reforma. Fase 2027-2032." },
              { mode: "reforma", label: "Reforma 2027", desc: "CBS 8,8% + IBS 17,7%. Novo IVA dual." },
            ].map((r) => (
              <button
                key={r.mode}
                onClick={() => isAdmin && changeRegime(r.mode)}
                className={`text-left rounded-lg border p-4 transition-all ${regime?.mode === r.mode ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/5 bg-slate-900/60 hover:border-white/10"} ${isAdmin ? "cursor-pointer" : "cursor-default opacity-70"}`}
                data-testid={`regime-${r.mode}`}
                disabled={!isAdmin}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-display font-semibold">{r.label}</div>
                  {regime?.mode === r.mode && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px]">ATIVO</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-white/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg gradient-indigo flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Motor Fiscal Clássico</div>
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
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center brand-glow">
                <Building2 className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <div className="font-display font-bold text-lg">Minha Empresa · Conta Mestre</div>
                <div className="label-mono">
                  MULTI-TENANT · PLANO {tenant?.plan?.toUpperCase() || "—"} · SLUG {tenant?.slug || "—"}
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <Label className="label-mono">NOME DA EMPRESA</Label>
                <Input
                  value={tenantEdit}
                  onChange={(e) => setTenantEdit(e.target.value)}
                  placeholder="Nome da sua empresa"
                  data-testid="tenant-name-input"
                />
              </div>
              <Button
                className="gradient-brand text-white brand-glow"
                onClick={saveTenant}
                disabled={!tenantEdit || tenantEdit === tenant?.name}
                data-testid="save-tenant-button"
              >
                Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Como <strong>conta mestre</strong>, você é o admin do seu tenant. Todos os leads, clientes,
              pedidos e usuários que você convidar ficam isolados neste tenant (multi-empresa por design).
            </p>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="glass border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-300" strokeWidth={2} />
                </div>
                <div>
                  <div className="font-display font-bold text-lg">Membros da Equipe</div>
                  <div className="label-mono">RBAC · ADMIN · VENDEDOR · CONTADOR · ISOLADO POR TENANT</div>
                </div>
              </div>
              <Button className="gradient-brand text-white brand-glow" onClick={() => setOpenUser(true)} data-testid="invite-member-button">
                <UserPlus className="w-4 h-4 mr-2" strokeWidth={2} /> Convidar
              </Button>
            </div>

            {invite && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4" data-testid="invite-credentials">
                <div className="label-mono text-emerald-300 mb-2 flex items-center gap-2">
                  <Mail className="w-3 h-3" strokeWidth={2.25} /> CONVITE CRIADO · ENVIE ESSAS CREDENCIAIS
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] label-mono mb-1">EMAIL</div>
                    <div className="mono flex items-center gap-2">
                      <span className="flex-1 truncate">{invite.email}</span>
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(invite.email); toast.success("Email copiado"); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] label-mono mb-1">SENHA TEMPORÁRIA</div>
                    <div className="mono flex items-center gap-2">
                      <span className="flex-1 truncate">{invite.password}</span>
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(invite.password); toast.success("Senha copiada"); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <button
                  className="mt-3 text-[11px] text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setInvite(null)}
                >
                  Fechar aviso
                </button>
              </div>
            )}

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
                  <tr key={u.id} className="border-b border-white/5" data-testid={`user-row-${u.id}`}>
                    <td className="p-3">{u.name}</td>
                    <td className="p-3 mono text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          u.role === "admin"
                            ? "border-cyan-500/40 text-cyan-300"
                            : u.role === "contador"
                            ? "border-violet-500/40 text-violet-300"
                            : "border-blue-500/40 text-blue-300"
                        }
                      >
                        {u.role.toUpperCase()}
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
          <DialogHeader><DialogTitle className="font-display text-xl">Convidar membro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="label-mono">NOME</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="invite-name-input" /></div>
            <div><Label className="label-mono">EMAIL</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="invite-email-input" /></div>
            <div><Label className="label-mono">PERFIL</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="invite-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="contador">Contador (read-only)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Uma senha temporária será gerada automaticamente. Você a verá após criar e poderá enviar
              ao convidado por qualquer canal.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenUser(false)}>Cancelar</Button>
            <Button className="gradient-brand text-white brand-glow" onClick={inviteMember} disabled={!form.email || !form.name} data-testid="send-invite-button">
              Gerar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
