import { useEffect, useState, useMemo } from "react";
import api, { formatBRL, formatError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Phone, Building2, DollarSign, MessageSquare } from "lucide-react";
import LeadDrawer from "@/pages/LeadDrawer";

const COLUMNS = [
  { id: "novo", label: "Novo", color: "border-blue-500/30 bg-blue-500/5 text-blue-300", dot: "bg-blue-400" },
  { id: "contato", label: "Em Contato", color: "border-purple-500/30 bg-purple-500/5 text-purple-300", dot: "bg-purple-400" },
  { id: "qualificado", label: "Qualificado", color: "border-amber-500/30 bg-amber-500/5 text-amber-300", dot: "bg-amber-400" },
  { id: "proposta", label: "Proposta", color: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300", dot: "bg-cyan-400" },
  { id: "ganho", label: "Ganho", color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300", dot: "bg-emerald-400" },
  { id: "perdido", label: "Perdido", color: "border-rose-500/30 bg-rose-500/5 text-rose-300", dot: "bg-rose-400" },
];

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [openDrawer, setOpenDrawer] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", company: "", source: "Manual", status: "novo", value: 0, notes: "",
  });

  const load = () => {
    setLoading(true);
    api.get("/leads").then(({ data }) => setLeads(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(COLUMNS.map((c) => [c.id, []]));
    leads.forEach((l) => { if (g[l.status]) g[l.status].push(l); });
    return g;
  }, [leads]);

  const totals = useMemo(
    () => Object.fromEntries(COLUMNS.map((c) => [c.id, grouped[c.id].reduce((s, l) => s + Number(l.value || 0), 0)])),
    [grouped]
  );

  const create = async () => {
    try {
      const { data } = await api.post("/leads", form);
      setLeads((prev) => [data, ...prev]);
      setOpenNew(false);
      setForm({ name: "", phone: "", email: "", company: "", source: "Manual", status: "novo", value: 0, notes: "" });
      toast.success("Lead criado");
    } catch (err) { toast.error(formatError(err)); }
  };

  const move = async (leadId, newStatus) => {
    const prev = leads;
    setLeads(leads.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    try {
      await api.patch(`/leads/${leadId}`, { status: newStatus });
    } catch (err) {
      setLeads(prev); toast.error(formatError(err));
    }
  };

  const onDragStart = (e, leadId) => {
    e.dataTransfer.setData("text/plain", leadId);
    e.currentTarget.classList.add("dragging");
  };
  const onDragEnd = (e) => e.currentTarget.classList.remove("dragging");
  const onDrop = (e, columnId) => {
    e.preventDefault(); setDragOver(null);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) move(leadId, columnId);
  };

  return (
    <div className="p-6 lg:p-8 flex flex-col h-full" data-testid="crm-page">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="label-mono">PIPELINE DE VENDAS · CRM</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Kanban de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Arraste os cards entre colunas para mudar o status.</p>
        </div>
        <Button className="gradient-emerald text-white shadow-lg shadow-emerald-500/20" onClick={() => setOpenNew(true)} data-testid="new-lead-button">
          <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Novo Lead
        </Button>
      </div>

      <div className="kanban-scroll flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 h-full" style={{ minWidth: `${COLUMNS.length * 300}px` }}>
          {COLUMNS.map((c) => (
            <div
              key={c.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(c.id); }}
              onDragLeave={() => setDragOver((s) => (s === c.id ? null : s))}
              onDrop={(e) => onDrop(e, c.id)}
              className={`kanban-column-drop flex-1 min-w-[280px] max-w-[320px] flex flex-col rounded-xl border ${c.color} p-3 ${dragOver === c.id ? "is-over" : ""}`}
              data-testid={`kanban-column-${c.id}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <span className="font-display font-bold text-sm">{c.label}</span>
                  <Badge variant="outline" className="border-white/10 text-muted-foreground text-[10px]">
                    {grouped[c.id].length}
                  </Badge>
                </div>
                <div className="text-[10px] mono text-muted-foreground">{formatBRL(totals[c.id])}</div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loading ? (
                  <div className="text-center text-xs text-muted-foreground py-8">Carregando...</div>
                ) : grouped[c.id].length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8 opacity-60">Sem leads</div>
                ) : (
                  grouped[c.id].map((l) => (
                    <Card
                      key={l.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, l.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => setOpenDrawer(l.id)}
                      className="kanban-card-drag glass p-3 border-white/5 hover:border-emerald-500/30 space-y-2"
                      data-testid={`lead-card-${l.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{l.name}</div>
                          {l.company && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3" strokeWidth={1.75} /> {l.company}
                            </div>
                          )}
                        </div>
                        {l.source === "WhatsApp" && (
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={2} />
                        )}
                      </div>
                      {l.phone && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mono">
                          <Phone className="w-3 h-3" strokeWidth={1.75} /> {l.phone}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <div className="text-xs mono text-emerald-300 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" strokeWidth={2} />
                          {formatBRL(l.value)}
                        </div>
                        <Badge variant="outline" className="border-white/10 text-[9px] px-1.5 py-0">
                          {l.source}
                        </Badge>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Lead Dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="glass-strong border-white/10 max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo Lead</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="label-mono">NOME</Label>
                <Input data-testid="new-lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="label-mono">EMPRESA</Label>
                <Input data-testid="new-lead-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div><Label className="label-mono">TELEFONE</Label>
                <Input data-testid="new-lead-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" /></div>
              <div><Label className="label-mono">EMAIL</Label>
                <Input data-testid="new-lead-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="label-mono">VALOR ESTIMADO</Label>
                <Input data-testid="new-lead-value" type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div><Label className="label-mono">ORIGEM</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger data-testid="new-lead-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="label-mono">NOTAS</Label>
              <Textarea data-testid="new-lead-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={create} disabled={!form.name} data-testid="save-lead-button">
              Criar lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadDrawer leadId={openDrawer} onClose={() => setOpenDrawer(null)} onChanged={load} />
    </div>
  );
}
