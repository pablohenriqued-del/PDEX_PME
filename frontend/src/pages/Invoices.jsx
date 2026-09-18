import { useEffect, useState } from "react";
import api, { API_BASE, formatBRL, formatDateTime } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FileCheck, FileText, Download } from "lucide-react";

const TAX_COLORS = { ICMS: "bg-indigo-500", PIS: "bg-emerald-500", COFINS: "bg-amber-500", ISS: "bg-pink-500", IPI: "bg-violet-500" };

export default function Invoices() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  useEffect(() => {
    (async () => {
      const [o, c] = await Promise.all([api.get("/orders"), api.get("/customers")]);
      const invLists = await Promise.all(
        o.data.map((ord) => api.get(`/orders/${ord.id}/invoices`).then((r) => r.data.map((i) => ({ ...i, order_number: ord.number, customer_id: ord.customer_id }))))
      );
      const flat = invLists.flat().sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));
      setOrders(flat); setCustomers(c.data); setLoading(false);
    })();
  }, []);

  const exportCSV = async () => {
    const token = localStorage.getItem("nexus_token");
    const q = month ? `?month=${month}` : "";
    const res = await fetch(`${API_BASE}/reports/invoices.csv${q}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas_fiscais${month ? "_" + month : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const custName = (id) => customers.find((c) => c.id === id)?.name || "—";

  return (
    <div className="p-6 lg:p-8" data-testid="invoices-page">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="label-mono">FISCAL · NOTAS</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground mt-1">NF-e para produtos · NFS-e para serviços. Decomposição tributária completa.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 bg-slate-900/60" data-testid="invoices-month-filter" placeholder="Filtrar mês" />
          <Button className="gradient-indigo text-white shadow-lg shadow-indigo-500/20" onClick={exportCSV} data-testid="export-invoices-csv">
            <Download className="w-4 h-4 mr-2" strokeWidth={2} /> Exportar CSV Contábil
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : orders.length === 0 ? (
        <Card className="glass border-white/5"><CardContent className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" strokeWidth={1.5} />
          <div className="text-muted-foreground">Nenhuma nota emitida ainda. Vá em um pedido e clique em "Emitir Nota".</div>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orders.map((inv) => (
            <Card key={inv.id} className="glass border-white/5 card-hover" data-testid={`invoice-item-${inv.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${inv.type === "NFSE" ? "gradient-emerald" : "gradient-indigo"} flex items-center justify-center`}>
                      <FileCheck className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-display font-bold text-lg">
                        {inv.type} <span className="mono text-muted-foreground text-sm">#{inv.number}</span>
                      </div>
                      <div className="label-mono">
                        PEDIDO #{String(inv.order_number).padStart(4, "0")} · {custName(inv.customer_id)}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 uppercase">{inv.status}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div><div className="label-mono">BRUTO</div><div className="mono">{formatBRL(inv.total_gross)}</div></div>
                  <div><div className="label-mono">TRIBUTOS</div><div className="mono text-amber-300">{formatBRL(inv.total_taxes)}</div></div>
                  <div><div className="label-mono">LÍQUIDO</div><div className="mono text-emerald-300 font-semibold">{formatBRL(inv.total_net)}</div></div>
                </div>
                <div className="space-y-2">
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
                <div className="text-[10px] text-muted-foreground mt-4 mono truncate">CHAVE {inv.access_key}</div>
                <div className="text-xs text-muted-foreground mono">Emitida em {formatDateTime(inv.issued_at)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
