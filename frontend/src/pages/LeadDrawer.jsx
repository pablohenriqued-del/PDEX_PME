import { useEffect, useState, useRef } from "react";
import api, { formatBRL, formatDateTime, formatError } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Phone, Mail, Building2, MessageSquare, UserPlus, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS = [
  { id: "novo", label: "Novo" },
  { id: "contato", label: "Em Contato" },
  { id: "qualificado", label: "Qualificado" },
  { id: "proposta", label: "Proposta" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
];

export default function LeadDrawer({ leadId, onClose, onChanged }) {
  const [lead, setLead] = useState(null);
  const [msg, setMsg] = useState("");
  const [simIn, setSimIn] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    if (!leadId) return;
    try {
      const { data } = await api.get(`/leads/${leadId}`);
      setLead(data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) { toast.error(formatError(err)); }
  };

  useEffect(() => { setLead(null); load(); /* eslint-disable-next-line */ }, [leadId]);

  if (!leadId) return null;

  const updateField = async (field, value) => {
    try {
      const { data } = await api.patch(`/leads/${leadId}`, { [field]: value });
      setLead((prev) => ({ ...prev, ...data }));
      onChanged?.();
    } catch (err) { toast.error(formatError(err)); }
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.post(`/leads/${leadId}/messages`, { body: msg });
      setMsg("");
      await load();
      toast.success("Mensagem enviada");
    } catch (err) { toast.error(formatError(err)); }
    finally { setSending(false); }
  };

  const simulateIncoming = async () => {
    if (!simIn.trim() || !lead?.phone) return;
    try {
      await api.post(`/whatsapp/simulate`, null, { params: { phone: lead.phone, body: simIn, name: lead.name } });
      setSimIn("");
      await load();
      toast.success("Mensagem recebida (simulada)");
    } catch (err) { toast.error(formatError(err)); }
  };

  const convertToCustomer = async () => {
    try {
      const { data } = await api.post(`/customers/from_lead/${leadId}`);
      toast.success("Cliente criado a partir do lead");
      onChanged?.();
      navigate("/orders?customer=" + data.id + "&lead=" + leadId);
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="glass-strong border-white/10 sm:max-w-[600px] w-full p-0 flex flex-col" data-testid="lead-drawer">
        <SheetHeader className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2 label-mono">
            <span className="status-dot text-emerald-400 pulse-dot" />
            EVOLUTION API {lead?.source === "WhatsApp" ? "· WHATSAPP" : ""}
          </div>
          <SheetTitle className="font-display text-2xl">
            {lead ? lead.name : "Carregando..."}
          </SheetTitle>
          {lead && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              {lead.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{lead.company}</span>}
              {lead.phone && <span className="flex items-center gap-1 mono"><Phone className="w-3 h-3" />{lead.phone}</span>}
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
            </div>
          )}
        </SheetHeader>

        {lead && (
          <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 bg-slate-900/60 border border-white/5">
              <TabsTrigger value="chat" data-testid="tab-chat">
                <MessageSquare className="w-4 h-4 mr-2" strokeWidth={1.75} /> Conversa
              </TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">Detalhes</TabsTrigger>
              <TabsTrigger value="actions" data-testid="tab-actions">
                <Sparkles className="w-4 h-4 mr-2" strokeWidth={1.75} /> Ações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden mt-0">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" data-testid="lead-chat-history">
                {lead.messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-12">
                    Nenhuma mensagem ainda. Envie a primeira ou aguarde o webhook.
                  </div>
                )}
                {lead.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.direction === "out" ? "chat-bubble-out" : "chat-bubble-in"}`}>
                      <div>{m.body}</div>
                      <div className={`text-[10px] mono mt-1 ${m.direction === "out" ? "text-emerald-50/80" : "text-slate-400"}`}>
                        {formatDateTime(m.created_at)} {m.author ? `· ${m.author}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-white/5 p-4 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite uma resposta via WhatsApp..."
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    className="bg-slate-900/60"
                    data-testid="chat-message-input"
                  />
                  <Button
                    className="gradient-emerald text-white"
                    onClick={sendMessage}
                    disabled={sending || !msg.trim()}
                    data-testid="send-message-button"
                  >
                    <Send className="w-4 h-4" strokeWidth={2} />
                  </Button>
                </div>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer label-mono flex items-center gap-1"><Zap className="w-3 h-3" strokeWidth={2} /> SIMULAR MENSAGEM RECEBIDA (WEBHOOK)</summary>
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Simular texto recebido..." value={simIn} onChange={(e) => setSimIn(e.target.value)} className="bg-slate-900/60 text-xs" data-testid="simulate-incoming-input" />
                    <Button variant="outline" size="sm" onClick={simulateIncoming} data-testid="simulate-incoming-button">Receber</Button>
                  </div>
                </details>
              </div>
            </TabsContent>

            <TabsContent value="details" className="flex-1 overflow-y-auto p-6 space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="label-mono mb-1">STATUS</div>
                  <Select value={lead.status} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger data-testid="details-status"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="label-mono mb-1">VALOR</div>
                  <Input type="number" step="0.01" defaultValue={lead.value} onBlur={(e) => updateField("value", parseFloat(e.target.value || 0))} data-testid="details-value" />
                </div>
                <div>
                  <div className="label-mono mb-1">TELEFONE</div>
                  <Input defaultValue={lead.phone || ""} onBlur={(e) => updateField("phone", e.target.value)} />
                </div>
                <div>
                  <div className="label-mono mb-1">EMAIL</div>
                  <Input defaultValue={lead.email || ""} onBlur={(e) => updateField("email", e.target.value)} />
                </div>
              </div>
              <div>
                <div className="label-mono mb-1">EMPRESA</div>
                <Input defaultValue={lead.company || ""} onBlur={(e) => updateField("company", e.target.value)} />
              </div>
              <div>
                <div className="label-mono mb-1">NOTAS</div>
                <Textarea rows={5} defaultValue={lead.notes || ""} onBlur={(e) => updateField("notes", e.target.value)} data-testid="details-notes" />
              </div>
              <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="label-mono">CRIADO</span><div className="mono">{formatDateTime(lead.created_at)}</div></div>
                <div><span className="label-mono">ATUALIZADO</span><div className="mono">{formatDateTime(lead.updated_at)}</div></div>
              </div>
            </TabsContent>

            <TabsContent value="actions" className="flex-1 overflow-y-auto p-6 space-y-3 mt-0">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" strokeWidth={1.75} />
                  <div className="font-display font-semibold">Converter em Cliente + Pedido</div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Cria um cliente PJ/PF com consentimento LGPD, marca o lead como Ganho e leva você direto para o novo pedido.
                </p>
                <Button className="gradient-emerald text-white" onClick={convertToCustomer} data-testid="convert-lead-button">
                  Converter agora
                </Button>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 space-y-2">
                <div className="label-mono">STATUS ATUAL</div>
                <Badge variant="outline" className="text-sm capitalize">{lead.status}</Badge>
                <div className="label-mono pt-3">ORIGEM</div>
                <Badge variant="outline" className="text-sm">{lead.source}</Badge>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
