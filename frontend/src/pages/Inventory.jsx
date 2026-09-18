import { useEffect, useState } from "react";
import api, { formatError, formatDateTime } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Warehouse, Store, ShoppingBag, Globe, Boxes, ExternalLink, RefreshCw, Zap,
} from "lucide-react";

const CHANNEL_ICONS = { marketplace: ShoppingBag, physical_store: Store, ecommerce: Globe };

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({ per_channel: [], per_product: [] });
  const [loading, setLoading] = useState(true);
  const [openInv, setOpenInv] = useState(false);
  const [openCh, setOpenCh] = useState(false);
  const [formInv, setFormInv] = useState({ product_id: "", channel_id: "", quantity: 0, external_sku: "", external_url: "" });
  const [formCh, setFormCh] = useState({ name: "", type: "marketplace", external_url: "", is_active: true });

  const load = async () => {
    setLoading(true);
    try {
      const [i, c, p, s] = await Promise.all([
        api.get("/inventory"),
        api.get("/inventory/channels"),
        api.get("/products"),
        api.get("/inventory/summary"),
      ]);
      setInventory(i.data);
      setChannels(c.data);
      setProducts(p.data.filter((x) => x.type === "product"));
      setSummary(s.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const saveInv = async () => {
    try {
      await api.post("/inventory", {
        product_id: formInv.product_id,
        channel_id: formInv.channel_id,
        quantity: parseInt(formInv.quantity) || 0,
        external_sku: formInv.external_sku || null,
        external_url: formInv.external_url || null,
      });
      setOpenInv(false);
      setFormInv({ product_id: "", channel_id: "", quantity: 0, external_sku: "", external_url: "" });
      load();
      toast.success("Estoque atualizado");
    } catch (err) { toast.error(formatError(err)); }
  };

  const saveCh = async () => {
    try {
      await api.post("/inventory/channels", formCh);
      setOpenCh(false);
      setFormCh({ name: "", type: "marketplace", external_url: "", is_active: true });
      load();
      toast.success("Canal criado");
    } catch (err) { toast.error(formatError(err)); }
  };

  const syncChannel = async (channelId) => {
    try {
      const { data } = await api.post(`/marketplace/sync/${channelId}`);
      toast.success(`Sincronizado: ${data.sales_captured} vendas · ${data.products_synced} produtos`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  const syncAll = async () => {
    try {
      const { data } = await api.post(`/marketplace/sync_all`);
      toast.success(`${data.synced} canais sincronizados`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="inventory-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="label-mono">OPERAÇÃO · INVENTÁRIO</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Inventário Multi-Canal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estoque por produto em cada marketplace, e-commerce próprio e lojas físicas.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setOpenCh(true)} data-testid="new-channel-button">
              <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Novo Canal
            </Button>
            <Button variant="outline" onClick={syncAll} data-testid="sync-all-button">
              <Zap className="w-4 h-4 mr-2 text-amber-300" strokeWidth={2} /> Sync Todos
            </Button>
            <Button className="gradient-emerald text-white" onClick={() => setOpenInv(true)} data-testid="new-inventory-button">
              <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Ajustar Estoque
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {summary.per_channel.slice(0, 4).map((s) => {
          const Icon = CHANNEL_ICONS[s.type] || Warehouse;
          return (
            <Card key={s.channel} className="glass border-white/5 card-hover">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-4 h-4 text-emerald-300" strokeWidth={1.75} />
                  <Badge variant="outline" className="text-[10px] uppercase">{s.type.replace("_", " ")}</Badge>
                </div>
                <div className="label-mono">{s.channel}</div>
                <div className="font-display text-2xl font-bold mono mt-1">{s.quantity}</div>
                <div className="text-xs text-muted-foreground mt-1">unidades em estoque</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="bg-slate-900/60 border border-white/5">
          <TabsTrigger value="inventory" data-testid="tab-inventory">Estoque ({inventory.length})</TabsTrigger>
          <TabsTrigger value="channels" data-testid="tab-channels">Canais ({channels.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <Card className="glass border-white/5">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">Carregando...</div>
              ) : inventory.length === 0 ? (
                <div className="p-12 text-center">
                  <Boxes className="w-10 h-10 mx-auto opacity-30 mb-2" strokeWidth={1.5} />
                  <div className="text-muted-foreground">Nenhum item de estoque configurado. Ajuste em "Ajustar Estoque".</div>
                </div>
              ) : (
                <table className="w-full text-sm" data-testid="inventory-table">
                  <thead>
                    <tr className="text-left label-mono border-b border-white/5">
                      <th className="p-3">PRODUTO</th>
                      <th className="p-3">CANAL</th>
                      <th className="p-3">SKU EXTERNO</th>
                      <th className="p-3 text-right">QTD</th>
                      <th className="p-3 text-right">RESERVADO</th>
                      <th className="p-3">ATUALIZADO</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((it) => (
                      <tr key={it.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`inventory-row-${it.id}`}>
                        <td className="p-3 font-medium">{it.product_name}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="border-white/10">
                            {it.channel_name}
                            <span className="ml-2 text-[9px] uppercase text-muted-foreground">{it.channel_type?.replace("_", " ")}</span>
                          </Badge>
                        </td>
                        <td className="p-3 mono text-xs text-muted-foreground">{it.external_sku || "—"}</td>
                        <td className="p-3 text-right mono font-semibold text-emerald-300">{it.quantity}</td>
                        <td className="p-3 text-right mono text-amber-300">{it.reserved}</td>
                        <td className="p-3 text-xs text-muted-foreground mono">{it.last_sync_at ? formatDateTime(it.last_sync_at) : "—"}</td>
                        <td className="p-3 text-right">
                          {it.external_url && (
                            <a href={it.external_url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 text-xs">
                              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} /> Abrir
                            </a>
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

        <TabsContent value="channels" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {channels.map((c) => {
              const Icon = CHANNEL_ICONS[c.type] || Warehouse;
              return (
                <Card key={c.id} className="glass border-white/5 card-hover" data-testid={`channel-card-${c.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${c.type === "marketplace" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : c.type === "physical_store" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"}`}>
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">{c.type.replace("_", " ")}</Badge>
                    </div>
                    <div className="font-display font-semibold">{c.name}</div>
                    {c.external_url && (
                      <a href={c.external_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 hover:underline mono truncate block mt-1">
                        {c.external_url}
                      </a>
                    )}
                    <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className={c.is_active ? "text-emerald-300" : "text-muted-foreground"}>{c.is_active ? "● ATIVO" : "○ INATIVO"}</span>
                      {isAdmin && (c.type === "marketplace" || c.type === "ecommerce") ? (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-300 hover:bg-amber-500/10" onClick={() => syncChannel(c.id)} data-testid={`sync-channel-${c.id}`}>
                          <RefreshCw className="w-3 h-3 mr-1" strokeWidth={1.75} /> Sync
                        </Button>
                      ) : (
                        <RefreshCw className="w-3 h-3 text-muted-foreground" strokeWidth={1.75} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Inventory Dialog */}
      <Dialog open={openInv} onOpenChange={setOpenInv}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader><DialogTitle className="font-display text-xl">Ajustar estoque</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="label-mono">PRODUTO</Label>
              <Select value={formInv.product_id} onValueChange={(v) => setFormInv({ ...formInv, product_id: v })}>
                <SelectTrigger data-testid="inv-product-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="label-mono">CANAL</Label>
              <Select value={formInv.channel_id} onValueChange={(v) => setFormInv({ ...formInv, channel_id: v })}>
                <SelectTrigger data-testid="inv-channel-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="label-mono">QUANTIDADE</Label>
              <Input type="number" value={formInv.quantity} onChange={(e) => setFormInv({ ...formInv, quantity: e.target.value })} data-testid="inv-quantity-input" />
            </div>
            <div><Label className="label-mono">SKU NO CANAL (opcional)</Label>
              <Input value={formInv.external_sku} onChange={(e) => setFormInv({ ...formInv, external_sku: e.target.value })} placeholder="Ex.: MLB123456789" />
            </div>
            <div><Label className="label-mono">URL DO ANÚNCIO (opcional)</Label>
              <Input value={formInv.external_url} onChange={(e) => setFormInv({ ...formInv, external_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenInv(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={saveInv} disabled={!formInv.product_id || !formInv.channel_id} data-testid="save-inventory-button">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Dialog */}
      <Dialog open={openCh} onOpenChange={setOpenCh}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo canal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="label-mono">NOME</Label>
              <Input value={formCh.name} onChange={(e) => setFormCh({ ...formCh, name: e.target.value })} data-testid="channel-name-input" />
            </div>
            <div><Label className="label-mono">TIPO</Label>
              <Select value={formCh.type} onValueChange={(v) => setFormCh({ ...formCh, type: v })}>
                <SelectTrigger data-testid="channel-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketplace">Marketplace</SelectItem>
                  <SelectItem value="physical_store">Loja Física</SelectItem>
                  <SelectItem value="ecommerce">E-commerce Próprio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="label-mono">URL</Label>
              <Input value={formCh.external_url} onChange={(e) => setFormCh({ ...formCh, external_url: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCh(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={saveCh} disabled={!formCh.name} data-testid="save-channel-button">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
