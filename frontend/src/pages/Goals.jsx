import { useEffect, useState } from "react";
import api, { formatBRL, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Target, Trophy, Coins, Plus, CheckCircle2 } from "lucide-react";

const now = () => new Date();
const currentMonth = () => `${now().getFullYear()}-${String(now().getMonth() + 1).padStart(2, "0")}`;

export default function Goals() {
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [progress, setProgress] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [prodGoals, setProdGoals] = useState([]);
  const [open, setOpen] = useState(false);
  const [openProd, setOpenProd] = useState(false);
  const [form, setForm] = useState({ user_id: "", target_amount: 50000, commission_rate: 0.05 });
  const [prodForm, setProdForm] = useState({ user_id: "", product_id: "", target_qty: 10, target_amount: 5000 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [prog, comm, prods, pgoals] = await Promise.all([
        api.get(`/goals/progress`, { params: { month } }),
        api.get(`/goals/commissions`, { params: { month } }),
        api.get(`/products`),
        api.get(`/goals/products/progress`, { params: { month } }),
      ]);
      setProgress(prog.data);
      setCommissions(comm.data);
      setProducts(prods.data);
      setProdGoals(pgoals.data);
      if (isAdmin) {
        const u = await api.get("/auth/users");
        setUsers(u.data.filter((x) => x.role === "vendedor"));
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const save = async () => {
    try {
      await api.post("/goals", { ...form, month, target_amount: Number(form.target_amount), commission_rate: Number(form.commission_rate) });
      setOpen(false);
      load();
      toast.success("Meta salva");
    } catch (err) { toast.error(formatError(err)); }
  };

  const markCommissionPaid = async (id) => {
    try {
      await api.post(`/goals/commissions/${id}/mark_paid`);
      load();
      toast.success("Comissão paga");
    } catch (err) { toast.error(formatError(err)); }
  };

  const saveProdGoal = async () => {
    try {
      await api.post("/goals/products", {
        ...prodForm, month,
        target_qty: parseInt(prodForm.target_qty) || 0,
        target_amount: Number(prodForm.target_amount) || 0,
      });
      setOpenProd(false);
      setProdForm({ user_id: "", product_id: "", target_qty: 10, target_amount: 5000 });
      load();
      toast.success("Meta por produto salva");
    } catch (err) { toast.error(formatError(err)); }
  };

  const totalCommissionAccrued = commissions.filter((c) => c.status === "accrued").reduce((s, c) => s + Number(c.amount), 0);
  const totalCommissionPaid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="goals-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="label-mono">PERFORMANCE · METAS</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Metas & Comissões</h1>
          <p className="text-sm text-muted-foreground mt-1">Metas mensais por vendedor com comissão automática ao marcar pagamento como pago.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 bg-slate-900/60" data-testid="goals-month-input" />
          {isAdmin && (
            <Button className="gradient-emerald text-white" onClick={() => setOpen(true)} data-testid="new-goal-button">
              <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Nova Meta
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="glass border-white/5"><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="label-mono">COMISSÃO ACUMULADA</div>
            <Coins className="w-4 h-4 text-emerald-300" strokeWidth={1.75} />
          </div>
          <div className="font-display text-2xl font-bold text-emerald-300 mono mt-1">{formatBRL(totalCommissionAccrued)}</div>
          <div className="text-xs text-muted-foreground mt-1">Aguardando pagamento</div>
        </CardContent></Card>
        <Card className="glass border-white/5"><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="label-mono">COMISSÃO PAGA</div>
            <CheckCircle2 className="w-4 h-4 text-indigo-300" strokeWidth={1.75} />
          </div>
          <div className="font-display text-2xl font-bold text-indigo-300 mono mt-1">{formatBRL(totalCommissionPaid)}</div>
          <div className="text-xs text-muted-foreground mt-1">No mês selecionado</div>
        </CardContent></Card>
        <Card className="glass border-white/5"><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="label-mono">VENDEDORES</div>
            <Trophy className="w-4 h-4 text-amber-300" strokeWidth={1.75} />
          </div>
          <div className="font-display text-2xl font-bold text-amber-300 mono mt-1">{progress.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Ativos no mês</div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="progress">
        <TabsList className="bg-slate-900/60 border border-white/5">
          <TabsTrigger value="progress" data-testid="tab-progress">Progresso</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-product-goals">Metas por Produto ({prodGoals.length})</TabsTrigger>
          <TabsTrigger value="commissions" data-testid="tab-commissions">Comissões ({commissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : progress.length === 0 ? (
            <Card className="glass border-white/5"><CardContent className="p-12 text-center">
              <Target className="w-10 h-10 mx-auto opacity-30 mb-2" strokeWidth={1.5} />
              <div className="text-muted-foreground">Nenhum vendedor com meta neste mês.</div>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progress.map((p) => {
                const pct = Math.min(100, Number(p.progress_pct));
                const tone = pct >= 100 ? "text-emerald-300" : pct >= 70 ? "text-amber-300" : pct >= 30 ? "text-indigo-300" : "text-rose-300";
                return (
                  <Card key={p.user_id} className="glass border-white/5 card-hover" data-testid={`progress-${p.user_id}`}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display font-bold text-lg">{p.user_name}</div>
                          <div className="label-mono">MÊS {p.month}</div>
                        </div>
                        <Badge className={pct >= 100 ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-slate-800/60 text-slate-300 border-white/10"}>
                          {pct >= 100 ? "META BATIDA 🏆" : `${pct.toFixed(1)}%`}
                        </Badge>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Realizado</span>
                          <span className={`mono font-semibold ${tone}`}>{formatBRL(p.achieved_amount)} / {formatBRL(p.target_amount)}</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
                        <div>
                          <div className="label-mono">TAXA</div>
                          <div className="mono text-emerald-300">{(Number(p.commission_rate) * 100).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="label-mono">COMISSÃO ACUMULADA</div>
                          <div className="mono text-emerald-300 font-semibold">{formatBRL(p.commission_accrued)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="label-mono">METAS DE VITRINE ESTRATÉGICA · POR SKU</div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setOpenProd(true)} data-testid="new-product-goal-button">
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} /> Nova Meta por Produto
              </Button>
            )}
          </div>
          {prodGoals.length === 0 ? (
            <Card className="glass border-white/5"><CardContent className="p-10 text-center text-sm text-muted-foreground">
              Sem metas por produto neste mês. Crie uma para direcionar o foco da equipe em SKUs prioritários.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {prodGoals.map((pg) => {
                const pct = Math.min(100, Number(pg.progress_pct));
                const tone = pct >= 100 ? "text-emerald-300" : pct >= 60 ? "text-amber-300" : "text-rose-300";
                return (
                  <Card key={pg.id} className="glass border-white/5" data-testid={`product-goal-${pg.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="label-mono truncate">{pg.product_sku || pg.product_id.slice(0, 8)}</div>
                          <div className="font-display font-semibold truncate">{pg.product_name}</div>
                          <div className="text-xs text-muted-foreground mt-1">{pg.user_name}</div>
                        </div>
                        <Badge className={pct >= 100 ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-slate-800/60 text-slate-300 border-white/10"}>
                          {pct.toFixed(1)}%
                        </Badge>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Realizado</span>
                          <span className={`mono font-semibold ${tone}`}>
                            {pg.achieved_qty}/{pg.target_qty} un · {formatBRL(pg.achieved_amount)} / {formatBRL(pg.target_amount)}
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>


        <TabsContent value="commissions" className="mt-4">
          <Card className="glass border-white/5">
            <CardContent className="p-0">
              {commissions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma comissão neste mês.</div>
              ) : (
                <table className="w-full text-sm" data-testid="commissions-table">
                  <thead>
                    <tr className="text-left label-mono border-b border-white/5">
                      <th className="p-3">VENDEDOR</th>
                      <th className="p-3">PEDIDO</th>
                      <th className="p-3">BASE</th>
                      <th className="p-3">TAXA</th>
                      <th className="p-3 text-right">COMISSÃO</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => {
                      const u = users.find((x) => x.id === c.user_id) || progress.find((x) => x.user_id === c.user_id);
                      return (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`commission-row-${c.id}`}>
                          <td className="p-3 font-medium">{u?.name || u?.user_name || c.user_id.slice(0, 6)}</td>
                          <td className="p-3 mono text-emerald-300">{c.order_id.slice(0, 8)}</td>
                          <td className="p-3 mono">{formatBRL(c.base_amount)}</td>
                          <td className="p-3 mono">{(Number(c.rate) * 100).toFixed(2)}%</td>
                          <td className="p-3 text-right mono text-emerald-300 font-semibold">{formatBRL(c.amount)}</td>
                          <td className="p-3">
                            {c.status === "paid" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">PAGA</Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-300">A PAGAR</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {isAdmin && c.status !== "paid" && (
                              <Button size="sm" variant="ghost" className="text-emerald-300 hover:bg-emerald-500/10" onClick={() => markCommissionPaid(c.id)} data-testid={`pay-commission-${c.id}`}>
                                Marcar paga
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader><DialogTitle className="font-display text-xl">Nova meta · {month}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="label-mono">VENDEDOR</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger data-testid="goal-user-select"><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="label-mono">META (R$)</Label>
              <Input type="number" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} data-testid="goal-target-input" />
            </div>
            <div><Label className="label-mono">TAXA DE COMISSÃO (0.05 = 5%)</Label>
              <Input type="number" step="0.001" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} data-testid="goal-rate-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={save} disabled={!form.user_id} data-testid="save-goal-button">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openProd} onOpenChange={setOpenProd}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader><DialogTitle className="font-display text-xl">Nova meta por produto · {month}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="label-mono">VENDEDOR</Label>
              <Select value={prodForm.user_id} onValueChange={(v) => setProdForm({ ...prodForm, user_id: v })}>
                <SelectTrigger data-testid="prodgoal-user-select"><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="label-mono">PRODUTO</Label>
              <Select value={prodForm.product_id} onValueChange={(v) => setProdForm({ ...prodForm, product_id: v })}>
                <SelectTrigger data-testid="prodgoal-product-select"><SelectValue placeholder="Selecione o produto/serviço" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku || "—"} · {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="label-mono">QTD ALVO</Label>
                <Input type="number" value={prodForm.target_qty} onChange={(e) => setProdForm({ ...prodForm, target_qty: e.target.value })} data-testid="prodgoal-qty-input" />
              </div>
              <div><Label className="label-mono">VALOR ALVO (R$)</Label>
                <Input type="number" step="0.01" value={prodForm.target_amount} onChange={(e) => setProdForm({ ...prodForm, target_amount: e.target.value })} data-testid="prodgoal-amount-input" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenProd(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={saveProdGoal} disabled={!prodForm.user_id || !prodForm.product_id} data-testid="save-prodgoal-button">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
