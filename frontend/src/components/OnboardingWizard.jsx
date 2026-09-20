import { useEffect, useState } from "react";
import api, { formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Landmark, Package, UserPlus, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { key: "empresa", label: "Empresa", icon: Building2 },
  { key: "fiscal", label: "Fiscal", icon: Landmark },
  { key: "produtos", label: "Produtos", icon: Package },
  { key: "convites", label: "Convites", icon: UserPlus },
];

export default function OnboardingWizard() {
  const { user, isAdmin } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [empresa, setEmpresa] = useState({ name: "" });
  const [fiscal, setFiscal] = useState({ mode: "classic" });
  const [produto, setProduto] = useState({ sku: "", name: "", price: "" });
  const [convite, setConvite] = useState({ email: "", name: "", role: "vendedor" });

  useEffect(() => {
    if (!user || !isAdmin) return;
    api.get("/tenant/me").then(({ data }) => {
      setTenant(data);
      setEmpresa({ name: data.name });
      if (!data.onboarding_completed) setOpen(true);
    }).catch(() => {});
  }, [user, isAdmin]);

  const next = async () => {
    setSaving(true);
    try {
      if (step === 0 && empresa.name && empresa.name !== tenant.name) {
        await api.patch("/tenant/me", { name: empresa.name });
      }
      if (step === 1) {
        await api.post(`/dashboard/fiscal_regime?mode=${fiscal.mode}`);
      }
      if (step === 2 && produto.name && produto.price) {
        await api.post("/products", {
          sku: produto.sku || null,
          name: produto.name,
          price: parseFloat(produto.price),
          type: "product",
          unit: "UN",
        });
        toast.success("Produto cadastrado");
      }
      if (step === 3 && convite.email && convite.name) {
        await api.post("/tenant/invite", convite);
        toast.success("Convite enviado por email");
      }
      if (step === STEPS.length - 1) {
        await api.post("/tenant/complete-onboarding");
        setOpen(false);
        setTimeout(() => window.location.reload(), 500);
      } else {
        setStep(step + 1);
      }
    } catch (err) { toast.error(formatError(err)); }
    finally { setSaving(false); }
  };

  const skip = async () => {
    try {
      await api.post("/tenant/complete-onboarding");
      setOpen(false);
    } catch { /* ignore */ }
  };

  if (!tenant || tenant.onboarding_completed) return null;

  const S = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-strong border-white/10 max-w-2xl" data-testid="onboarding-wizard">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div
                className={`flex items-center gap-2 ${i <= step ? "text-white" : "text-muted-foreground"}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                    i < step ? "gradient-brand border-transparent brand-glow" :
                    i === step ? "border-cyan-500/60 bg-cyan-500/10" : "border-white/10"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="w-4 h-4 text-white" /> : <s.icon className="w-4 h-4" strokeWidth={2} />}
                </div>
                <span className="text-xs font-mono uppercase tracking-wider hidden md:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-2 ${i < step ? "bg-cyan-500/40" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-cyan-300" strokeWidth={2.25} />
          <span className="label-mono">ONBOARDING · PASSO {step + 1} DE {STEPS.length}</span>
        </div>
        <h2 className="font-display font-extrabold text-2xl tracking-tight">
          {step === 0 && "Confirme os dados da sua empresa"}
          {step === 1 && "Escolha o regime fiscal"}
          {step === 2 && "Cadastre seu primeiro produto"}
          {step === 3 && "Convide um membro da equipe"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {step === 0 && "Você pode alterar o nome exibido nas notas e nos emails de convite."}
          {step === 1 && "Classic (pré-reforma), Transição (2027-2032) ou Reforma 2027 (CBS+IBS)."}
          {step === 2 && "Registre um item que você vende. Pode adicionar mais depois em Catálogo."}
          {step === 3 && "Envie o primeiro convite. Sua equipe recebe email com senha temporária."}
        </p>

        {step === 0 && (
          <div className="space-y-3">
            <Label className="label-mono">NOME DA EMPRESA</Label>
            <Input value={empresa.name} onChange={(e) => setEmpresa({ name: e.target.value })} data-testid="onb-empresa-name" />
          </div>
        )}
        {step === 1 && (
          <div className="grid md:grid-cols-3 gap-3">
            {["classic", "hybrid", "reforma"].map((m) => (
              <button
                key={m}
                onClick={() => setFiscal({ mode: m })}
                className={`text-left rounded-lg border p-4 transition-all ${
                  fiscal.mode === m ? "border-cyan-500/50 bg-cyan-500/5" : "border-white/10 bg-slate-900/60 hover:border-white/20"
                }`}
                data-testid={`onb-fiscal-${m}`}
              >
                <div className="font-display font-bold capitalize">{m === "hybrid" ? "Transição" : m === "reforma" ? "Reforma 2027" : "Classic"}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {m === "classic" && "ICMS/PIS/COFINS/ISS/IPI"}
                  {m === "hybrid" && "50% clássico + 50% reforma"}
                  {m === "reforma" && "CBS 8,8% + IBS 17,7%"}
                </div>
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label className="label-mono">SKU (OPCIONAL)</Label><Input value={produto.sku} onChange={(e) => setProduto({ ...produto, sku: e.target.value })} data-testid="onb-prod-sku" /></div>
            <div className="md:col-span-2"><Label className="label-mono">NOME</Label><Input value={produto.name} onChange={(e) => setProduto({ ...produto, name: e.target.value })} data-testid="onb-prod-name" /></div>
            <div><Label className="label-mono">PREÇO (R$)</Label><Input type="number" step="0.01" value={produto.price} onChange={(e) => setProduto({ ...produto, price: e.target.value })} data-testid="onb-prod-price" /></div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label className="label-mono">NOME</Label><Input value={convite.name} onChange={(e) => setConvite({ ...convite, name: e.target.value })} data-testid="onb-invite-name" /></div>
              <div><Label className="label-mono">EMAIL</Label><Input type="email" value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} data-testid="onb-invite-email" /></div>
            </div>
            <div><Label className="label-mono">PERFIL</Label>
              <Select value={convite.role} onValueChange={(v) => setConvite({ ...convite, role: v })}>
                <SelectTrigger data-testid="onb-invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="contador">Contador (read-only)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">Um email com a senha temporária será enviado automaticamente.</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" size="sm" onClick={skip} data-testid="onb-skip">Finalizar depois</Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={saving} data-testid="onb-back">
                Voltar
              </Button>
            )}
            <Button className="gradient-brand text-white brand-glow" onClick={next} disabled={saving} data-testid="onb-next">
              {step === STEPS.length - 1 ? "Concluir" : "Próximo"}
              <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2.25} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
