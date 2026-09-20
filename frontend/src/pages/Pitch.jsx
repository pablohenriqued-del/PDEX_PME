import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { PdexMark } from "@/components/PdexLogo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, ChevronLeft, ChevronRight, Printer, Sparkles, TrendingUp,
  Users, ShoppingCart, Landmark, Kanban, Building2, Target, ShieldCheck,
} from "lucide-react";

const formatBRL = (n) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function Pitch() {
  const { user, isSuperAdmin } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [summary, setSummary] = useState(null);
  const [leads, setLeads] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api.get("/tenant/me").then(({ data }) => setTenant(data)).catch(() => {});
    api.get("/dashboard/summary").then(({ data }) => setSummary(data)).catch(() => {});
    api.get("/leads").then(({ data }) => setLeads(data)).catch(() => setLeads([]));
    if (isSuperAdmin) api.get("/tenants").then(({ data }) => setTenants(data)).catch(() => {});
  }, [isSuperAdmin]);

  const pipeline = useMemo(() => {
    const counts = {};
    for (const l of leads) counts[l.status] = (counts[l.status] || 0) + 1;
    const total = leads.length || 1;
    return ["novo", "contato", "qualificado", "proposta", "ganho", "perdido"].map((s) => ({
      status: s,
      count: counts[s] || 0,
      pct: Math.round(((counts[s] || 0) / total) * 100),
    }));
  }, [leads]);

  const slides = [
    { key: "cover" },
    { key: "kpis" },
    { key: "pipeline" },
    { key: "team" },
    { key: "cta" },
  ];

  const go = (i) => setIdx(Math.max(0, Math.min(slides.length - 1, i)));
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [idx]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-white" data-testid="pitch-page" style={{ background: "#050916" }}>
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 15% 20%, rgba(59,130,246,.22), transparent 55%), radial-gradient(ellipse at 85% 80%, rgba(139,92,246,.18), transparent 55%)" }} />
      </div>

      {/* Progress */}
      <div className="fixed top-0 left-0 h-[3px] z-20 gradient-brand transition-all duration-500" style={{ width: `${((idx + 1) / slides.length) * 100}%`, boxShadow: "0 0 12px rgba(59,130,246,.6)" }} />

      {/* Exit + counter */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" data-testid="pitch-exit" className="text-muted-foreground hover:text-white">
            Voltar ao dashboard →
          </Button>
        </Link>
      </div>
      <div className="absolute top-4 left-4 z-20 mono text-[10px] tracking-[.18em] text-muted-foreground uppercase flex items-center gap-2">
        <PdexMark size={22} />
        PITCH · {tenant?.name || "..."} · {String(idx + 1).padStart(2, "0")}/{String(slides.length).padStart(2, "0")}
      </div>

      {/* Slides */}
      <div className="relative w-full h-full">
        {/* 1 · Cover */}
        <Slide active={idx === 0}>
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6"><PdexMark size={72} /></div>
            <div className="label-mono">O SEU PDEX EM NÚMEROS · {tenant?.name || ""}</div>
            <h1 className="font-display font-extrabold text-5xl lg:text-7xl leading-[1.02] tracking-tight mt-4">
              Olá, <span className="gradient-brand-text">{user?.name?.split(" ")[0] || "Pablo"}</span>.
              Aqui está sua operação.
            </h1>
            <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
              Uma visão executiva ao vivo — faturamento, pipeline e equipe puxados agora do banco,
              formatados como uma apresentação de investidor.
            </p>
            <div className="mono text-[10px] tracking-[.28em] text-muted-foreground mt-10">
              PRESSIONE → PARA COMEÇAR
            </div>
          </div>
        </Slide>

        {/* 2 · KPIs */}
        <Slide active={idx === 1}>
          <div className="max-w-6xl mx-auto w-full">
            <div className="label-mono">KPIS FINANCEIROS · PERÍODO ATUAL</div>
            <h2 className="font-display font-extrabold text-4xl lg:text-5xl mt-2 tracking-tight">
              Sua operação está <span className="gradient-brand-text">rodando</span>.
            </h2>
            <div className="grid md:grid-cols-4 gap-5 mt-10">
              <KpiCard icon={TrendingUp} label="FATURAMENTO BRUTO" value={formatBRL(summary?.total_gross)} />
              <KpiCard icon={Landmark} label="TRIBUTOS" value={formatBRL(summary?.total_taxes)} accent="violet" />
              <KpiCard icon={ShoppingCart} label="PEDIDOS" value={summary?.orders_count ?? "-"} accent="cyan" />
              <KpiCard icon={Users} label="LEADS ATIVOS" value={leads.filter((l) => !["ganho", "perdido"].includes(l.status)).length} accent="emerald" />
            </div>
            <div className="mt-8 text-sm text-muted-foreground">
              Líquido após impostos: <strong className="text-white">{formatBRL(summary?.total_net)}</strong>
              {" · "}
              Ticket médio: <strong className="text-white">{formatBRL((summary?.total_gross || 0) / (summary?.orders_count || 1))}</strong>
            </div>
          </div>
        </Slide>

        {/* 3 · Pipeline */}
        <Slide active={idx === 2}>
          <div className="max-w-6xl mx-auto w-full">
            <div className="label-mono flex items-center gap-2"><Kanban className="w-3 h-3" strokeWidth={2.25} /> CRM · PIPELINE ATUAL</div>
            <h2 className="font-display font-extrabold text-4xl lg:text-5xl mt-2 tracking-tight">
              {leads.length} leads distribuídos em <span className="gradient-brand-text">6 etapas</span>.
            </h2>
            <div className="mt-10 space-y-3">
              {pipeline.map((p) => (
                <div key={p.status} className="flex items-center gap-4" data-testid={`pitch-pipeline-${p.status}`}>
                  <div className="w-28 label-mono text-right uppercase">{p.status}</div>
                  <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full gradient-brand brand-glow transition-all duration-1000" style={{ width: `${p.pct}%` }} />
                  </div>
                  <div className="w-20 mono text-sm text-right">{p.count} · <span className="text-muted-foreground">{p.pct}%</span></div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* 4 · Team / Tenants */}
        <Slide active={idx === 3}>
          <div className="max-w-5xl mx-auto w-full">
            <div className="label-mono flex items-center gap-2">
              {isSuperAdmin ? <><Building2 className="w-3 h-3" strokeWidth={2.25} /> SUPER-ADMIN · SUAS EMPRESAS</> : <><Target className="w-3 h-3" strokeWidth={2.25} /> EQUIPE ATUAL</>}
            </div>
            <h2 className="font-display font-extrabold text-4xl lg:text-5xl mt-2 tracking-tight">
              {isSuperAdmin ? (
                <>Você opera <span className="gradient-brand-text">{tenants.length}</span> {tenants.length === 1 ? "empresa" : "empresas"}.</>
              ) : (
                <>Sua conta é <span className="gradient-brand-text">{tenant?.name}</span>.</>
              )}
            </h2>
            <div className="grid md:grid-cols-3 gap-4 mt-10">
              {(isSuperAdmin ? tenants : [tenant].filter(Boolean)).slice(0, 6).map((t) => (
                <div key={t.id} className="glass rounded-2xl p-5 border border-white/10 card-hover">
                  <div className="flex items-center gap-3 mb-3">
                    <PdexMark size={32} animated={false} />
                    <div className="min-w-0">
                      <div className="font-display font-bold truncate">{t.name}</div>
                      <div className="mono text-[10px] text-muted-foreground uppercase">{t.slug} · {t.plan}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {t.onboarding_completed ? (
                      <span className="mono text-emerald-300">● ATIVO</span>
                    ) : (
                      <span className="mono text-amber-300">● ONBOARDING</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* 5 · CTA */}
        <Slide active={idx === 4}>
          <div className="text-center max-w-3xl mx-auto">
            <div className="label-mono flex items-center gap-2 justify-center"><Sparkles className="w-3 h-3" strokeWidth={2.25} /> PRÓXIMO PASSO</div>
            <h1 className="font-display font-extrabold text-5xl lg:text-6xl leading-[1.02] tracking-tight mt-4">
              Continue vendendo com <span className="gradient-brand-text">clareza total</span>.
            </h1>
            <p className="text-lg text-muted-foreground mt-6">
              Volte pro dashboard, atue nos leads da coluna Novo, feche pedidos e assista os KPIs subirem em tempo real.
            </p>
            <div className="flex justify-center gap-3 mt-10">
              <Link to="/dashboard">
                <Button size="lg" className="h-12 px-7 gradient-brand text-white font-semibold brand-glow" data-testid="pitch-back-dashboard">
                  Ir para o dashboard <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2.25} />
                </Button>
              </Link>
              <Link to="/crm">
                <Button size="lg" variant="outline" className="h-12 px-7 border-white/15">
                  Abrir CRM Kanban
                </Button>
              </Link>
            </div>
            <div className="mt-14 flex items-center justify-center gap-2 mono text-[10px] tracking-[.28em] text-muted-foreground">
              <ShieldCheck className="w-3 h-3" strokeWidth={2.25} /> DADOS AO VIVO · LGPD · SEM SNAPSHOTS
            </div>
          </div>
        </Slide>
      </div>

      {/* Controls */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass-strong rounded-full border border-white/10 px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={prev} disabled={idx === 0} className="rounded-full h-8 w-8 p-0" data-testid="pitch-prev">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex gap-1.5 px-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 gradient-brand" : "w-1.5 bg-white/15 hover:bg-white/30"}`}
              data-testid={`pitch-dot-${i}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <span className="mono text-[10px] tracking-widest text-muted-foreground px-2">
          {String(idx + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
        <Button variant="ghost" size="sm" onClick={next} disabled={idx === slides.length - 1} className="rounded-full h-8 w-8 p-0" data-testid="pitch-next">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Slide({ active, children }) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center p-8 lg:p-16 transition-all duration-700 ${active ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 pointer-events-none translate-x-8"}`}
    >
      <div className="w-full">{children}</div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent = "brand" }) {
  const ring = { brand: "from-cyan-500/30 to-violet-500/30", cyan: "from-cyan-500/40 to-cyan-500/10", emerald: "from-emerald-500/40 to-emerald-500/10", violet: "from-violet-500/40 to-violet-500/10" }[accent];
  return (
    <div className="glass rounded-2xl p-6 border border-white/10 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${ring} blur-2xl opacity-40`} />
      <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center brand-glow mb-4">
        <Icon className="w-5 h-5 text-white" strokeWidth={2} />
      </div>
      <div className="label-mono">{label}</div>
      <div className="font-mono text-3xl font-bold gradient-brand-text mt-2">{value}</div>
    </div>
  );
}
