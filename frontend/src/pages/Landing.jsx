import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import PdexLogo, { PdexMark } from "@/components/PdexLogo";
import {
  ArrowRight, Kanban, MessageSquare, Package, FileText,
  LineChart, Target, ShieldCheck, Sparkles, Building2, Zap, Cloud,
} from "lucide-react";

const FEATURES = [
  { icon: Kanban, title: "CRM Kanban", desc: "Pipeline de vendas com drag-and-drop, histórico de conversas e conversão em cliente + pedido num clique." },
  { icon: MessageSquare, title: "WhatsApp integrado", desc: "Recebe mensagens da Evolution API, cria leads automaticamente e centraliza o atendimento." },
  { icon: Package, title: "Catálogo & Estoque", desc: "Produtos, serviços, controle multi-canal (loja física, marketplaces) e alertas de estoque mínimo." },
  { icon: FileText, title: "Fiscal + Reforma", desc: "Cálculo automático por UF (ICMS, PIS, COFINS, ISS, IPI) e simulação IBS/CBS da reforma 2027." },
  { icon: LineChart, title: "Financeiro em tempo real", desc: "Faturamento bruto/líquido, tributos por tipo, contas a receber e evolução mensal em gráficos vivos." },
  { icon: Target, title: "Metas & Comissão", desc: "Metas por vendedor e produto, comissão calculada automaticamente ao marcar pagamento como recebido." },
];

const PILLARS = [
  { label: "SIMPLES", value: "PME", desc: "Feito para o seu negócio" },
  { label: "INTELIGENTE", value: "ERP", desc: "Tudo em um só lugar" },
  { label: "ESCALÁVEL", value: "∞", desc: "Cresce com você" },
];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden" data-testid="landing-page">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 gradient-brand opacity-[0.06]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.20),transparent_55%)]" />
        <div className="absolute top-1/4 -left-40 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.16),transparent_70%)] blur-3xl" />
      </div>

      {/* Nav */}
      <header className="max-w-7xl mx-auto px-6 lg:px-10 pt-8 flex items-center justify-between">
        <PdexLogo size={40} compact />
        <div className="flex items-center gap-3">
          <a
            href="#recursos"
            className="hidden md:inline text-sm text-muted-foreground hover:text-white transition-colors"
            data-testid="landing-nav-features"
          >
            Recursos
          </a>
          <a
            href="#pilares"
            className="hidden md:inline text-sm text-muted-foreground hover:text-white transition-colors"
            data-testid="landing-nav-pillars"
          >
            Por que PDEX
          </a>
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/5" data-testid="landing-login-link">
              Entrar
            </Button>
          </Link>
          <Link to="/login">
            <Button size="sm" className="gradient-brand text-white font-semibold brand-glow" data-testid="landing-cta-header">
              Acessar plataforma <ArrowRight className="w-3.5 h-3.5 ml-1.5" strokeWidth={2.25} />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-24 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-8">
          <div className="label-mono flex items-center gap-2">
            <Sparkles className="w-3 h-3" strokeWidth={2.25} />
            PLATAFORMA · PME · ERP · SEM LIMITES
          </div>
          <h1 className="font-display font-extrabold text-5xl lg:text-6xl leading-[1.02] tracking-tight">
            Gestão completa para{" "}
            <span className="gradient-brand-text">empresas que querem ir além</span>.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            CRM Kanban com WhatsApp integrado, catálogo, vendas, emissão fiscal com decomposição
            tributária, dashboard financeiro em tempo real, metas e comissão automática — tudo num
            só ERP feito para PMEs brasileiras. Simples, inteligente, escalável.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/login">
              <Button size="lg" className="h-12 px-6 gradient-brand text-white font-semibold brand-glow" data-testid="landing-cta-primary">
                Entrar agora <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2.25} />
              </Button>
            </Link>
            <a href="#recursos">
              <Button size="lg" variant="outline" className="h-12 px-6 border-white/15 hover:bg-white/5" data-testid="landing-cta-secondary">
                Ver recursos
              </Button>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} /> LGPD compliant</div>
            <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-cyan-400" strokeWidth={2} /> Reforma tributária 2027</div>
            <div className="flex items-center gap-1.5"><Cloud className="w-3.5 h-3.5 text-violet-400" strokeWidth={2} /> Nuvem · Multi-canal</div>
          </div>
        </div>

        {/* Hero card mockup */}
        <div className="lg:col-span-5 relative">
          <div className="glass-strong rounded-3xl p-6 border border-white/10 brand-glow relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.35),transparent_70%)] blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <PdexMark size={28} />
                  <div className="label-mono">DASHBOARD · PDEX</div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" /> LIVE
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="glass rounded-xl p-3 border border-white/5">
                  <div className="label-mono">FATURAMENTO</div>
                  <div className="font-mono text-2xl font-bold gradient-brand-text mt-1">R$ 462k</div>
                  <div className="text-[10px] text-emerald-300 mt-0.5">+18% mês</div>
                </div>
                <div className="glass rounded-xl p-3 border border-white/5">
                  <div className="label-mono">TRIBUTOS</div>
                  <div className="font-mono text-2xl font-bold text-white mt-1">R$ 140k</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">ICMS · PIS · COFINS</div>
                </div>
              </div>
              <div className="glass rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="label-mono">CRM · PIPELINE</div>
                  <div className="text-[10px] text-muted-foreground">20 leads</div>
                </div>
                <div className="space-y-2">
                  {[
                    { s: "Novo", n: 3, c: "bg-slate-500/40" },
                    { s: "Qualificado", n: 3, c: "bg-cyan-500/60" },
                    { s: "Proposta", n: 4, c: "bg-blue-500/60" },
                    { s: "Ganho", n: 3, c: "bg-emerald-500/60" },
                  ].map((r) => (
                    <div key={r.s} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground">{r.s}</div>
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full ${r.c}`} style={{ width: `${r.n * 22}%` }} />
                      </div>
                      <div className="w-6 text-right font-mono text-xs">{r.n}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="pilares" className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid md:grid-cols-3 gap-5">
          {PILLARS.map((p) => (
            <div key={p.label} className="glass rounded-2xl p-6 border border-white/10 card-hover">
              <div className="font-mono text-5xl font-extrabold gradient-brand-text leading-none">{p.value}</div>
              <div className="label-mono mt-4">{p.label}</div>
              <div className="text-sm text-muted-foreground mt-1">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section id="recursos" className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="max-w-3xl mb-14">
          <div className="label-mono mb-3 flex items-center gap-2">
            <Building2 className="w-3 h-3" strokeWidth={2.25} /> MÓDULOS
          </div>
          <h2 className="font-display font-extrabold text-4xl tracking-tight">
            Um ERP inteiro em <span className="gradient-brand-text">uma plataforma</span>.
          </h2>
          <p className="text-muted-foreground mt-4">
            Sete módulos integrados que conversam entre si — do primeiro contato via WhatsApp até a
            nota fiscal emitida e a comissão paga ao vendedor.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 border border-white/10 card-hover"
              data-testid={`landing-feature-${f.title.split(" ")[0].toLowerCase()}`}
            >
              <div className="w-11 h-11 rounded-xl gradient-brand flex items-center justify-center brand-glow mb-4">
                <f.icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="font-display font-bold text-lg tracking-tight">{f.title}</div>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-24">
        <div className="glass-strong rounded-3xl p-10 lg:p-14 border border-white/10 brand-glow relative overflow-hidden text-center">
          <div className="absolute inset-0 gradient-brand opacity-[0.08]" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.35),transparent_70%)] blur-3xl" />
          <div className="relative">
            <div className="label-mono mb-4">O ERP QUE ACOMPANHA O SEU PRÓXIMO PASSO</div>
            <h3 className="font-display font-extrabold text-4xl lg:text-5xl tracking-tight max-w-3xl mx-auto">
              Pronto para vender, faturar e crescer{" "}
              <span className="gradient-brand-text">com clareza</span>?
            </h3>
            <p className="text-muted-foreground mt-5 max-w-xl mx-auto">
              Entre agora com as credenciais da sua empresa e comece a usar todos os módulos em
              minutos. Sem instalação, 100% na nuvem.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login">
                <Button size="lg" className="h-12 px-7 gradient-brand text-white font-semibold brand-glow" data-testid="landing-cta-final">
                  Entrar na plataforma <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2.25} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 lg:px-10 py-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <PdexLogo size={30} compact />
        <div className="label-mono text-center md:text-right">
          © 2026 PDEX · LGPD compliant · Reforma tributária ready · pdex.com.br
        </div>
      </footer>
    </div>
  );
}
