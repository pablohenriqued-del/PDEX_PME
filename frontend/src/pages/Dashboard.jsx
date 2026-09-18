import { useEffect, useState } from "react";
import api, { formatBRL, formatDate } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, Wallet, Receipt, FileCheck, Users2, ArrowUpRight, Coins,
  Trophy, Target, Sparkles,
} from "lucide-react";

const TAX_COLORS = { ICMS: "#6366f1", PIS: "#10b981", COFINS: "#f59e0b", ISS: "#ec4899", IPI: "#8b5cf6" };

function KpiCard({ label, value, icon: Icon, hint, trend, testId, tone = "emerald" }) {
  const tones = {
    emerald: "text-emerald-300 border-emerald-500/20 bg-emerald-500/5",
    indigo: "text-indigo-300 border-indigo-500/20 bg-indigo-500/5",
    amber: "text-amber-300 border-amber-500/20 bg-amber-500/5",
    rose: "text-rose-300 border-rose-500/20 bg-rose-500/5",
    cyan: "text-cyan-300 border-cyan-500/20 bg-cyan-500/5",
  };
  return (
    <Card className="glass border-white/5 card-hover" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs text-emerald-300">
              <ArrowUpRight className="w-3 h-3" strokeWidth={2} /> {trend}
            </div>
          )}
        </div>
        <div className="label-mono">{label}</div>
        <div className="font-display text-2xl font-bold mt-1 mono">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [companyGoal, setCompanyGoal] = useState(null);
  const [regime, setRegime] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard"),
      api.get("/dashboard/team_ranking"),
      api.get("/dashboard/company_goal"),
      api.get("/dashboard/fiscal_regime"),
    ]).then(([d, r, g, f]) => {
      setData(d.data); setRanking(r.data); setCompanyGoal(g.data); setRegime(f.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { kpis, monthly, tax_breakdown, receivables } = data;
  const monthlyChart = monthly.map((m) => ({
    month: new Date(m.month + "-01").toLocaleDateString("pt-BR", { month: "short" }),
    Bruto: Number(m.gross), Liquido: Number(m.net), Tributos: Number(m.taxes),
  }));

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="dashboard-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="label-mono">VISÃO GERAL · FINANCEIRO</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Faturamento, tributos e contas a receber em tempo real.</p>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
          <span className="status-dot text-emerald-400 mr-2 pulse-dot" /> ONLINE · ATUALIZADO AGORA
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="FATURAMENTO BRUTO" value={formatBRL(kpis.revenue_gross)} icon={TrendingUp} tone="emerald" hint="Total faturado (com impostos)" testId="kpi-revenue-gross" />
        <KpiCard label="FATURAMENTO LÍQUIDO" value={formatBRL(kpis.revenue_net)} icon={Wallet} tone="indigo" hint="Após dedução de tributos" testId="kpi-revenue-net" />
        <KpiCard label="TRIBUTOS PAGOS" value={formatBRL(kpis.total_taxes)} icon={Coins} tone="amber" hint="ICMS · PIS · COFINS · ISS · IPI" testId="kpi-total-taxes" />
        <KpiCard label="CONTAS A RECEBER" value={formatBRL(kpis.receivables)} icon={Receipt} tone="rose" hint={`${receivables.length} título(s) pendente(s)`} testId="kpi-receivables" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass border-white/5 lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="label-mono">EVOLUÇÃO MENSAL</div>
                <div className="font-display text-lg font-semibold mt-1">Faturamento bruto vs. líquido</div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Bruto</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" />Líquido</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyChart} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(203,213,225,0.5)" fontSize={11} />
                <YAxis stroke="rgba(203,213,225,0.5)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  formatter={(v) => formatBRL(v)}
                />
                <Area type="monotone" dataKey="Bruto" stroke="#10b981" strokeWidth={2} fill="url(#grGross)" />
                <Area type="monotone" dataKey="Liquido" stroke="#6366f1" strokeWidth={2} fill="url(#grNet)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass border-white/5">
          <CardContent className="p-6">
            <div className="label-mono">DECOMPOSIÇÃO TRIBUTÁRIA</div>
            <div className="font-display text-lg font-semibold mt-1 mb-4">Tributos por tipo</div>
            {tax_breakdown.length === 0 ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <FileCheck className="w-8 h-8 mb-2 opacity-40" strokeWidth={1.5} />
                Nenhuma nota emitida ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={tax_breakdown.map((t) => ({ name: t.tax_type, value: Number(t.amount) }))}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {tax_breakdown.map((t) => (
                      <Cell key={t.tax_type} fill={TAX_COLORS[t.tax_type] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    formatter={(v) => formatBRL(v)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-mono">CONTAS A RECEBER</div>
              <div className="font-display text-lg font-semibold mt-1">Pagamentos pendentes</div>
            </div>
            <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/20">{receivables.length} títulos</Badge>
          </div>
          {receivables.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento pendente 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="receivables-table">
                <thead>
                  <tr className="text-left label-mono border-b border-white/5">
                    <th className="pb-3">PEDIDO</th>
                    <th className="pb-3">CLIENTE</th>
                    <th className="pb-3">MÉTODO</th>
                    <th className="pb-3">VENCIMENTO</th>
                    <th className="pb-3 text-right">VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((r) => (
                    <tr key={r.payment_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 mono text-emerald-300">#{String(r.order_number).padStart(4, "0")}</td>
                      <td className="py-3">{r.customer_name}</td>
                      <td className="py-3"><Badge variant="outline" className="uppercase">{r.method}</Badge></td>
                      <td className="py-3 text-muted-foreground">{r.due_date ? formatDate(r.due_date) : "—"}</td>
                      <td className="py-3 text-right mono font-semibold">{formatBRL(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Goal + Team Ranking + Fiscal Regime */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass border-white/5 lg:col-span-2" data-testid="team-ranking-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="label-mono flex items-center gap-1"><Trophy className="w-3 h-3" strokeWidth={2} /> PLACAR DA EQUIPE</div>
                <div className="font-display text-lg font-semibold mt-1">Ranking do mês</div>
              </div>
              {companyGoal && (
                <div className="text-right">
                  <div className="label-mono">EMPRESA {companyGoal.month}</div>
                  <div className="text-sm font-semibold mt-1 mono">
                    <span className="text-emerald-300">{formatBRL(companyGoal.achieved)}</span>
                    <span className="text-muted-foreground"> / {formatBRL(companyGoal.target)}</span>
                  </div>
                </div>
              )}
            </div>
            {companyGoal && companyGoal.target > 0 && (
              <div className="mb-5">
                <Progress value={Math.min(100, Number(companyGoal.progress_pct))} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1 mono">{Number(companyGoal.progress_pct).toFixed(1)}% da meta consolidada</div>
              </div>
            )}
            <div className="space-y-2">
              {ranking.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Sem vendas no mês ainda.</div>
              ) : ranking.map((r) => {
                const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`;
                return (
                  <div key={r.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 hover:bg-slate-900/70 transition-colors" data-testid={`ranking-${r.user_id}`}>
                    <div className="w-9 text-center font-display text-lg font-bold">{medal}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.user_name}</div>
                      <div className="text-xs text-muted-foreground mono">{r.orders_count} pedidos · comissão {formatBRL(r.commission_accrued)}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-emerald-300 font-semibold">{formatBRL(r.achieved_amount)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {regime && (
          <Card className="glass border-white/5" data-testid="fiscal-regime-card">
            <CardContent className="p-6">
              <div className="label-mono flex items-center gap-1"><Sparkles className="w-3 h-3" strokeWidth={2} /> REGIME FISCAL ATIVO</div>
              <div className="font-display text-lg font-semibold mt-1">{regime.label}</div>
              <Badge className={`mt-3 uppercase ${regime.mode === "reforma" ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" : regime.mode === "hybrid" ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-slate-500/10 text-slate-300 border-slate-500/20"}`}>
                {regime.mode === "reforma" ? "REFORMA 2027" : regime.mode === "hybrid" ? "TRANSIÇÃO" : "CLASSIC"}
              </Badge>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{regime.description}</p>
              <div className="grid grid-cols-2 gap-2 mt-4 text-center">
                <div className="rounded-lg bg-slate-900/60 p-2 border border-white/5">
                  <div className="label-mono">CBS</div>
                  <div className="mono font-bold text-emerald-300 mt-0.5">{(Number(regime.cbs_rate) * 100).toFixed(2)}%</div>
                </div>
                <div className="rounded-lg bg-slate-900/60 p-2 border border-white/5">
                  <div className="label-mono">IBS (méd.)</div>
                  <div className="mono font-bold text-indigo-300 mt-0.5">{(Number(regime.ibs_rate) * 100).toFixed(2)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
