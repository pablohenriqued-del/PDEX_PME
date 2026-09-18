import { useEffect, useState } from "react";
import api, { formatBRL, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Box, Wrench, Package } from "lucide-react";

export default function Products() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { sku: "", name: "", description: "", type: "product", unit: "UN", price: 0, cost: 0, stock: 0, ncm: "", is_active: true };
  const [form, setForm] = useState(empty);

  const load = () => {
    setLoading(true);
    api.get("/products").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (p) => { setEditing(p); setForm({ ...empty, ...p }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) await api.patch(`/products/${editing.id}`, form);
      else await api.post("/products", form);
      setOpen(false);
      load();
      toast.success(editing ? "Produto atualizado" : "Produto cadastrado");
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="p-6 lg:p-8" data-testid="products-page">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="label-mono">GESTÃO · CATÁLOGO</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Produtos & Serviços</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie preços, estoque e NCM. NF-e para produtos, NFS-e para serviços.</p>
        </div>
        {isAdmin && (
          <Button className="gradient-emerald text-white" onClick={startNew} data-testid="new-product-button">
            <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Novo Item
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <Card className="glass border-white/5"><CardContent className="p-12 text-center">
          <Package className="w-10 h-10 mx-auto opacity-30 mb-2" />
          <div className="text-muted-foreground">Nenhum produto no catálogo.</div>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <Card
              key={p.id}
              onClick={() => isAdmin && startEdit(p)}
              className={`glass border-white/5 card-hover ${isAdmin ? "cursor-pointer" : ""}`}
              data-testid={`product-card-${p.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${p.type === "service" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"}`}>
                    {p.type === "service" ? <Wrench className="w-4 h-4" strokeWidth={1.75} /> : <Box className="w-4 h-4" strokeWidth={1.75} />}
                  </div>
                  <Badge variant="outline" className="text-[10px] mono">{p.sku || "—"}</Badge>
                </div>
                <div className="font-display font-semibold text-base leading-tight">{p.name}</div>
                {p.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</div>}
                <div className="flex items-end justify-between mt-4 pt-3 border-t border-white/5">
                  <div>
                    <div className="label-mono">PREÇO</div>
                    <div className="font-display text-xl font-bold text-emerald-300 mono">{formatBRL(p.price)}</div>
                  </div>
                  <div className="text-right">
                    <div className="label-mono">{p.type === "service" ? "TIPO" : "ESTOQUE"}</div>
                    <div className="mono text-sm">{p.type === "service" ? "Serviço" : `${p.stock} ${p.unit}`}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-white/10 max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editing ? "Editar" : "Novo"} Item</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="label-mono">TIPO</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="prod-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="product">Produto (NF-e)</SelectItem><SelectItem value="service">Serviço (NFS-e)</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="label-mono">SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} data-testid="prod-sku" /></div>
            <div className="col-span-2"><Label className="label-mono">NOME</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="prod-name" /></div>
            <div className="col-span-2"><Label className="label-mono">DESCRIÇÃO</Label><Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label className="label-mono">PREÇO (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} data-testid="prod-price" /></div>
            <div><Label className="label-mono">CUSTO (R$)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label className="label-mono">UNIDADE</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div><Label className="label-mono">ESTOQUE</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} /></div>
            <div className="col-span-2"><Label className="label-mono">NCM (apenas produtos)</Label><Input value={form.ncm || ""} onChange={(e) => setForm({ ...form, ncm: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={save} disabled={!form.name} data-testid="save-product-button">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
