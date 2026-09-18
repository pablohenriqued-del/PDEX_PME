import { useEffect, useState, useRef } from "react";
import api, { formatError, formatDateTime, formatBRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, MessageSquare, Phone, Zap, ArrowRight, Sparkles, Search } from "lucide-react";

const STATUS_LABEL = { novo: "Novo", contato: "Em Contato", qualificado: "Qualificado", proposta: "Proposta", ganho: "Ganho", perdido: "Perdido" };
const STATUS_COLORS = {
  novo: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  contato: "text-purple-300 bg-purple-500/10 border-purple-500/20",
  qualificado: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  proposta: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
  ganho: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  perdido: "text-rose-300 bg-rose-500/10 border-rose-500/20",
};

export default function Whatsapp() {
  const [leads, setLeads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState("");
  const [simIn, setSimIn] = useState("");
  const [search, setSearch] = useState("");
  const [waStatus, setWaStatus] = useState({ configured: false });
  const bottomRef = useRef(null);

  const load = async () => {
    const { data } = await api.get("/leads");
    const chats = data.filter((l) => l.source === "WhatsApp" || l.phone);
    setLeads(chats);
    if (!activeId && chats.length) setActiveId(chats[0].id);
  };
  const loadStatus = async () => {
    try { const { data } = await api.get("/whatsapp/status"); setWaStatus(data); } catch {}
  };
  useEffect(() => { load(); loadStatus(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!activeId) { setDetail(null); return; }
    (async () => {
      try {
        const { data } = await api.get(`/leads/${activeId}`);
        setDetail(data);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
      } catch {}
    })();
  }, [activeId]);

  const send = async () => {
    if (!msg.trim()) return;
    try {
      await api.post(`/leads/${activeId}/messages`, { body: msg });
      setMsg("");
      const { data } = await api.get(`/leads/${activeId}`);
      setDetail(data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) { toast.error(formatError(err)); }
  };

  const simulate = async () => {
    if (!simIn.trim() || !detail?.phone) return;
    try {
      await api.post(`/whatsapp/simulate`, null, { params: { phone: detail.phone, body: simIn, name: detail.name } });
      setSimIn("");
      const { data } = await api.get(`/leads/${activeId}`);
      setDetail(data);
    } catch (err) { toast.error(formatError(err)); }
  };

  const setStatus = async (status) => {
    try {
      const { data } = await api.patch(`/leads/${activeId}`, { status });
      setDetail((prev) => ({ ...prev, ...data }));
      load();
      toast.success(`Lead marcado como ${STATUS_LABEL[status]}`);
    } catch (err) { toast.error(formatError(err)); }
  };

  const convertToCustomer = async () => {
    try {
      await api.post(`/customers/from_lead/${activeId}`);
      toast.success("Conversa transformada em cliente + lead Ganho");
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.name || "").toLowerCase().includes(s) || (l.phone || "").includes(s) || (l.company || "").toLowerCase().includes(s);
  });

  return (
    <div className="flex h-full" data-testid="whatsapp-page">
      {/* Inbox list */}
      <aside className="w-80 border-r border-white/5 flex flex-col glass">
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="label-mono">ATENDIMENTO</div>
              <div className="font-display font-bold text-lg">Inbox WhatsApp</div>
            </div>
            <Badge className={waStatus.configured ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-amber-500/10 text-amber-300 border-amber-500/20"}>
              <span className="status-dot text-current mr-1.5 pulse-dot" />
              {waStatus.configured ? "AO VIVO" : "DEMO"}
            </Badge>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-slate-900/60" data-testid="whatsapp-search" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>
          ) : filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveId(l.id)}
              className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/[0.03] ${activeId === l.id ? "bg-emerald-500/[0.06] border-l-2 border-l-emerald-400" : ""}`}
              data-testid={`whatsapp-conversation-${l.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm truncate">{l.name}</div>
                <Badge variant="outline" className={`text-[9px] uppercase ${STATUS_COLORS[l.status]}`}>{STATUS_LABEL[l.status]}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3 h-3" strokeWidth={1.75} />
                <span className="mono">{l.phone || "-"}</span>
              </div>
              {l.value > 0 && (
                <div className="text-[11px] text-emerald-300 mono mt-1">{formatBRL(l.value)}</div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat panel */}
      <section className="flex-1 flex flex-col min-w-0">
        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto opacity-20 mb-3" strokeWidth={1.5} />
              <div>Selecione uma conversa para começar</div>
            </div>
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-white/5 flex items-center justify-between glass">
              <div>
                <div className="label-mono flex items-center gap-2">
                  <span className="status-dot text-emerald-400 pulse-dot" />
                  EVOLUTION API · WHATSAPP
                </div>
                <div className="font-display font-bold text-xl mt-0.5">{detail.name}</div>
                <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                  {detail.phone && <span className="mono">{detail.phone}</span>}
                  {detail.company && <span>· {detail.company}</span>}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Select value={detail.status} onValueChange={setStatus}>
                  <SelectTrigger className="w-40" data-testid="whatsapp-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button className="gradient-emerald text-white" onClick={convertToCustomer} data-testid="whatsapp-convert-button">
                  <Sparkles className="w-4 h-4 mr-2" strokeWidth={2} /> Virar Cliente
                </Button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-950/40" data-testid="whatsapp-messages">
              {detail.messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">
                  Nenhuma mensagem ainda. Envie a primeira ou aguarde uma resposta.
                </div>
              ) : detail.messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[65%] rounded-2xl px-3.5 py-2 text-sm ${m.direction === "out" ? "chat-bubble-out" : "chat-bubble-in"}`}>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div className={`text-[10px] mono mt-1 ${m.direction === "out" ? "text-emerald-50/80" : "text-slate-400"}`}>
                      {formatDateTime(m.created_at)} {m.author ? `· ${m.author}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <footer className="p-4 border-t border-white/5 space-y-2 glass">
              <div className="flex gap-2">
                <Input
                  placeholder="Escreva sua resposta..."
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  className="bg-slate-900/60"
                  data-testid="whatsapp-message-input"
                />
                <Button className="gradient-emerald text-white" onClick={send} disabled={!msg.trim()} data-testid="whatsapp-send-button">
                  <Send className="w-4 h-4" strokeWidth={2} />
                </Button>
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer label-mono flex items-center gap-1"><Zap className="w-3 h-3" /> SIMULAR MENSAGEM RECEBIDA</summary>
                <div className="flex gap-2 mt-2">
                  <Input placeholder="Simular texto recebido..." value={simIn} onChange={(e) => setSimIn(e.target.value)} className="bg-slate-900/60 text-xs" data-testid="whatsapp-simulate-input" />
                  <Button variant="outline" size="sm" onClick={simulate} data-testid="whatsapp-simulate-button">Receber</Button>
                </div>
              </details>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
