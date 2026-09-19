import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import PdexLogo, { PdexMark, PdexWordmark } from "@/components/PdexLogo";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("pablohenriqued@gmail.com");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo(a) ao PDEX");
      navigate("/dashboard");
    } catch (err) {
      const msg = formatError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="hidden lg:flex relative overflow-hidden">
        <div className="absolute inset-0 gradient-brand opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_85%,rgba(139,92,246,0.22),transparent_60%)]" />
        <div className="absolute -right-32 top-1/4 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_70%)] blur-2xl" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <PdexMark size={52} />
            <div>
              <PdexWordmark height={32} />
              <div className="label-mono mt-1.5">PME · ERP · SEM LIMITES</div>
            </div>
          </div>

          <div className="space-y-8 max-w-lg">
            <div>
              <div className="label-mono mb-3 flex items-center gap-2">
                <Sparkles className="w-3 h-3" strokeWidth={2} /> PLATAFORMA
              </div>
              <h1 className="font-display font-extrabold text-5xl leading-[1.05] tracking-tight">
                Gestão completa para <span className="gradient-brand-text">empresas que querem ir além</span>.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                CRM Kanban com WhatsApp, catálogo, vendas, emissão fiscal com decomposição tributária
                e dashboard financeiro em tempo real. Simples, inteligente, escalável.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "SIMPLES", value: "PME" },
                { label: "INTELIGENTE", value: "ERP" },
                { label: "ESCALÁVEL", value: "∞" },
              ].map((s) => (
                <div key={s.label} className="glass p-4 rounded-xl border border-white/10">
                  <div className="font-mono text-3xl font-bold gradient-brand-text">{s.value}</div>
                  <div className="label-mono mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="label-mono">© 2026 PDEX · LGPD compliant · Reforma tributária ready</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md glass-strong border-white/10">
          <CardContent className="p-8">
            <div className="lg:hidden mb-8">
              <PdexLogo size={40} showTagline />
            </div>

            <div className="label-mono mb-2">ACESSO AO SISTEMA</div>
            <h2 className="font-display text-3xl font-bold tracking-tight mb-1">Entrar na plataforma</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Use suas credenciais para gerir vendas, clientes e fiscal.
            </p>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="label-mono">EMAIL</Label>
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-11 bg-slate-900/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="label-mono">SENHA</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="login-password-input"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-11 bg-slate-900/60 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    data-testid="toggle-password-visibility"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" data-testid="login-error">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 gradient-brand hover:opacity-95 text-white font-semibold brand-glow"
                data-testid="login-submit-button"
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-6 p-3 rounded-lg bg-slate-900/60 border border-white/5 text-xs">
              <div className="label-mono mb-2">CONTAS DE DEMONSTRAÇÃO · CLIQUE PARA USAR</div>
              <div className="space-y-1.5">
                {[
                  { r: "admin", e: "pablohenriqued@gmail.com", p: "PDEX@2026", tone: "text-cyan-300" },
                  { r: "vendedor", e: "vendedor@pdex.com.br", p: "Vendedor@PDEX2026", tone: "text-blue-300" },
                  { r: "contador", e: "contador@pdex.com.br", p: "Contador@PDEX2026", tone: "text-violet-300" },
                ].map((c) => (
                  <button
                    key={c.e}
                    type="button"
                    onClick={() => { setEmail(c.e); setPassword(c.p); }}
                    className="w-full text-left flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
                    data-testid={`demo-${c.r}-button`}
                  >
                    <span className={`${c.tone} mono w-16`}>{c.r}</span>
                    <span className="mono truncate flex-1">{c.e}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
