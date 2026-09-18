import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { formatBRL, formatDateTime, formatError, formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileCheck, CreditCard, Receipt, CheckCircle2, DollarSign, Coins } from "lucide-react";

const TAX_COLORS = { ICMS: "bg-indigo-500", PIS: "bg-emerald-500", COFINS: "bg-amber-500", ISS: "bg-pink-500", IPI: "bg-violet-500" };

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [payMethod, setPayMethod] = useState("pix");
  const [payAmount, setPayAmount] = useState(0);
  const [payDue, setPayDue] = useState("");
  const [emitting, setEmitting] = useState(false);

  const load = async () => {
    try {
      const [o, prods, pays, invs] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/products`),
        api.get(`/orders/${id}/payments`),
        api.get(`/orders/${id}/invoices`),
      ]);
      setOrder(o.data); setProducts(prods.data); setPayments(pays.data); setInvoices(invs.data);
    } catch (err) { toast.error(formatError(err)); navigate("/orders"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!order) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  const addItem = async () => {
    try {
      await api.post(`/orders/${id}/items`, { product_id: productId, quantity: parseFloat(quantity) });
      setAddOpen(false); setProductId(""); setQuantity(1);
      load();
      toast.success("Item adicionado");
    } catch (err) { toast.error(formatError(err)); }
  };

  const removeItem = async (itemId) => {
    try { await api.delete(`/orders/${id}/items/${itemId}`); load(); toast.success("Item removido"); }
    catch (err) { toast.error(formatError(err)); }
  };

  const emitInvoice = async () => {
    setEmitting(true);
    try {
      const { data } = await api.post(`/orders/${id}/invoice`);
      toast.success(`${data.type} #${data.number} emitida`);
      load();
    } catch (err) { toast.error(formatError(err)); }
    finally { setEmitting(false); }
  };

  const addPayment = async () => {
    try {
      await api.post(`/orders/${id}/payments`, { method: payMethod, amount: parseFloat(payAmount), due_date: payDue || null });
      setPayOpen(false); setPayAmount(0); setPayDue("");
      load();
      toast.success("Pagamento registrado");
    } catch (err) { toast.error(formatError(err)); }
  };

  const markPaid = async (pid) => {
    try { await api.post(`/orders/${id}/payments/${pid}/mark_paid`); load(); toast.success("Marcado como pago"); }
    catch (err) { toast.error(formatError(err)); }
  };

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(order.total_gross) - totalPaid - totalPending);

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="order-detail-page">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/orders")} className="mb-3 -ml-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" strokeWidth={1.75} /> Voltar
        </Button>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="label-mono">PEDIDO</div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1 flex items-center gap-3">
              <span className="mono text-emerald-300">#{String(order.number).padStart(4, "0")}</span>
              <Badge className="uppercase">{order.status}</Badge>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPayOpen(true)} data-testid="new-payment-button">
              <CreditCard className="w-4 h-4 mr-2" strokeWidth={1.75} /> Pagamento
            </Button>
            <Button
              className="gradient-indigo text-white shadow-lg shadow-indigo-500/20"
              onClick={emitInvoice}
              disabled={emitting || order.items.length === 0}
              data-testid="emit-invoice-button"
            >
              <FileCheck className="w-4 h-4 mr-2" strokeWidth={1.75} /> {emitting ? "Emitindo..." : "Emitir Nota"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "TOTAL BRUTO", val: order.total_gross, icon: DollarSign, tone: "text-slate-300" },
          { label: "TRIBUTOS", val: order.total_taxes, icon: Coins, tone: "text-amber-300" },
          { label: "TOTAL LÍQUIDO", val: order.total_net, icon: Receipt, tone: "text-emerald-300" },
          { label: "A RECEBER", val: remaining, icon: CreditCard, tone: "text-rose-300" },
        ].map((k) => (
          <Card key={k.label} className="glass border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="label-mono">{k.label}</div>
                <k.icon className={`w-4 h-4 ${k.tone}`} strokeWidth={1.75} />
              </div>
              <div className={`font-display text-xl font-bold mono mt-1 ${k.tone}`}>{formatBRL(k.val)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="items">
        <TabsList className="bg-slate-900/60 border border-white/5">
          <TabsTrigger value="items" data-testid="tab-order-items">Itens ({order.items.length})</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-order-payments">Pagamentos ({payments.length})</TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-order-invoices">Notas ({invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <Card className="glass border-white/5">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="label-mono">ITENS DO PEDIDO</div>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} data-testid="add-item-button">
                  <Plus className="w-4 h-4 mr-1" strokeWidth={2} /> Adicionar item
                </Button>
              </div>
              {order.items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Sem itens. Adicione produtos ou serviços.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left label-mono border-b border-white/5">
                      <th className="p-3">DESCRIÇÃO</th>
                      <th className="p-3 text-right">QTD</th>
                      <th className="p-3 text-right">UNITÁRIO</th>
                      <th className="p-3 text-right">SUBTOTAL</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((it) => (
                      <tr key={it.id} className="border-b border-white/5" data-testid={`order-item-${it.id}`}>
                        <td className="p-3">
                          <div className="font-medium">{it.description}</div>
                          <div className="text-xs text-muted-foreground uppercase">{it.type === "service" ? "Serviço" : "Produto"}</div>
                        </td>
                        <td className="p-3 text-right mono">{Number(it.quantity)}</td>
                        <td className="p-3 text-right mono">{formatBRL(it.unit_price)}</td>
                        <td className="p-3 text-right mono font-semibold">{formatBRL(it.subtotal)}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(it.id)} className="text-rose-300 hover:bg-rose-500/10">
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="glass border-white/5">
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pagamento.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left label-mono border-b border-white/5">
                      <th className="p-3">MÉTODO</th>
                      <th className="p-3">VENCIMENTO</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3 text-right">VALOR</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-white/5" data-testid={`payment-row-${p.id}`}>
                        <td className="p-3"><Badge variant="outline" className="uppercase">{p.method}</Badge></td>
                        <td className="p-3 text-muted-foreground">{p.due_date ? formatDate(p.due_date) : "—"}</td>
                        <td className="p-3">
                          {p.status === "paid" ? (
                            <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">PAGO</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-300">PENDENTE</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right mono font-semibold">{formatBRL(p.amount)}</td>
                        <td className="p-3 text-right">
                          {p.status !== "paid" && (
                            <Button size="sm" variant="ghost" className="text-emerald-300 hover:bg-emerald-500/10" onClick={() => markPaid(p.id)} data-testid={`mark-paid-${p.id}`}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} /> Marcar pago
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          {invoices.length === 0 ? (
            <Card className="glass border-white/5"><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma nota emitida.</CardContent></Card>
          ) : invoices.map((inv) => (
            <Card key={inv.id} className="glass border-white/5" data-testid={`invoice-card-${inv.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-indigo flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-display font-bold text-lg">{inv.type} <span className="mono text-muted-foreground text-sm">#{inv.number}</span></div>
                      <div className="label-mono text-emerald-300">CHAVE {inv.access_key?.slice(0, 12)}...</div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 uppercase">{inv.status}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div><div className="label-mono">BRUTO</div><div className="mono">{formatBRL(inv.total_gross)}</div></div>
                  <div><div className="label-mono">TRIBUTOS</div><div className="mono text-amber-300">{formatBRL(inv.total_taxes)}</div></div>
                  <div><div className="label-mono">LÍQUIDO</div><div className="mono text-emerald-300 font-semibold">{formatBRL(inv.total_net)}</div></div>
                </div>
                <div className="space-y-2">
                  <div className="label-mono">DECOMPOSIÇÃO TRIBUTÁRIA</div>
                  {inv.taxes.map((t) => (
                    <div key={t.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${TAX_COLORS[t.tax_type] || "bg-slate-500"}`} />
                          <span className="font-semibold">{t.tax_type}</span>
                          <span className="text-muted-foreground">· {(Number(t.rate) * 100).toFixed(2)}%</span>
                        </div>
                        <span className="mono">{formatBRL(t.amount)}</span>
                      </div>
                      <Progress value={(Number(t.amount) / Number(inv.total_taxes || 1)) * 100} className="h-1" />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-4 mono">Emitida em {formatDateTime(inv.issued_at)}</div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Add Item */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader><DialogTitle className="font-display text-xl">Adicionar item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="label-mono mb-1">PRODUTO / SERVIÇO</div>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger data-testid="add-item-product-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatBRL(p.price)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="label-mono mb-1">QUANTIDADE</div>
              <Input type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="add-item-quantity" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={addItem} disabled={!productId} data-testid="save-item-button">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Payment */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="label-mono mb-1">MÉTODO</div>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="label-mono mb-1">VALOR (R$)</div>
              <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} data-testid="payment-amount-input" />
            </div>
            <div>
              <div className="label-mono mb-1">VENCIMENTO</div>
              <Input type="date" value={payDue} onChange={(e) => setPayDue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={addPayment} disabled={!payAmount} data-testid="save-payment-button">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
