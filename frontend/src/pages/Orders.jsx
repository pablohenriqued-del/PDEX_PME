import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { formatBRL, formatDate, formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ShoppingCart, ArrowRight } from "lucide-react";

const STATUS_STYLES = {
  draft: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  confirmed: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  invoiced: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/orders"), api.get("/customers")]).then(([o, c]) => {
      setOrders(o.data); setCustomers(c.data);
      const pre = params.get("customer");
      if (pre && c.data.some((x) => x.id === pre)) { setCustomerId(pre); setOpen(true); }
    }).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line

  const create = async () => {
    try {
      const { data } = await api.post("/orders", {
        customer_id: customerId,
        lead_id: params.get("lead") || null,
        items: [],
      });
      setOpen(false);
      toast.success(`Pedido #${String(data.number).padStart(4, "0")} criado`);
      navigate(`/orders/${data.id}`);
    } catch (err) { toast.error(formatError(err)); }
  };

  const custName = (id) => customers.find((c) => c.id === id)?.name || "—";

  return (
    <div className="p-6 lg:p-8" data-testid="orders-page">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="label-mono">VENDAS · PEDIDOS</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão end-to-end: itens, pagamentos e emissão fiscal.</p>
        </div>
        <Button className="gradient-emerald text-white" onClick={() => { setCustomerId(""); setOpen(true); }} data-testid="new-order-button">
          <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Novo Pedido
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : orders.length === 0 ? (
        <Card className="glass border-white/5"><CardContent className="p-12 text-center">
          <ShoppingCart className="w-10 h-10 mx-auto opacity-30 mb-2" strokeWidth={1.5} />
          <div className="text-muted-foreground">Nenhum pedido ainda. Crie o primeiro a partir de um cliente ou lead ganho.</div>
        </CardContent></Card>
      ) : (
        <Card className="glass border-white/5">
          <CardContent className="p-0">
            <table className="w-full text-sm" data-testid="orders-table">
              <thead>
                <tr className="text-left label-mono border-b border-white/5">
                  <th className="p-4">#</th>
                  <th className="p-4">CLIENTE</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4 text-right">BRUTO</th>
                  <th className="p-4 text-right">TRIBUTOS</th>
                  <th className="p-4 text-right">LÍQUIDO</th>
                  <th className="p-4">CRIADO</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)} data-testid={`order-row-${o.id}`}>
                    <td className="p-4 mono text-emerald-300 font-semibold">#{String(o.number).padStart(4, "0")}</td>
                    <td className="p-4">{custName(o.customer_id)}</td>
                    <td className="p-4"><Badge className={`${STATUS_STYLES[o.status]} uppercase`}>{o.status}</Badge></td>
                    <td className="p-4 text-right mono">{formatBRL(o.total_gross)}</td>
                    <td className="p-4 text-right mono text-amber-300">{formatBRL(o.total_taxes)}</td>
                    <td className="p-4 text-right mono text-emerald-300 font-semibold">{formatBRL(o.total_net)}</td>
                    <td className="p-4 text-xs text-muted-foreground">{formatDate(o.created_at)}</td>
                    <td className="p-4 text-right"><ArrowRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-white/10 max-w-md">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo pedido</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="label-mono">CLIENTE</div>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger data-testid="order-customer-select"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
              <SelectContent>
                {customers.filter((c) => !c.anonymized).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customers.length === 0 && (
              <div className="text-xs text-amber-300 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                Nenhum cliente cadastrado. Vá em Clientes → Novo Cliente ou converta um lead ganho no CRM.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={create} disabled={!customerId} data-testid="save-order-button">Criar pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
