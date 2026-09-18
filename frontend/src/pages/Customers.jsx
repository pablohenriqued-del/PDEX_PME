import { useEffect, useState } from "react";
import api, { formatError, formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Shield, AlertTriangle, Users, Building2, User } from "lucide-react";

export default function Customers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmAnon, setConfirmAnon] = useState(null);
  const [form, setForm] = useState({
    name: "", document: "", person_type: "PF", email: "", phone: "",
    address: "", city: "", state: "", ibge_code: "", zip_code: "", lgpd_consent: false,
  });

  const load = () => {
    setLoading(true);
    api.get("/customers").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    try {
      await api.post("/customers", form);
      setOpen(false);
      setForm({ name: "", document: "", person_type: "PF", email: "", phone: "", address: "", city: "", state: "", ibge_code: "", zip_code: "", lgpd_consent: false });
      load();
      toast.success("Cliente cadastrado");
    } catch (err) { toast.error(formatError(err)); }
  };

  const anonymize = async () => {
    try {
      await api.post(`/customers/${confirmAnon}/anonymize`);
      setConfirmAnon(null);
      load();
      toast.success("Cliente anonimizado (LGPD)");
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="p-6 lg:p-8" data-testid="customers-page">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="label-mono">CRM · CLIENTES</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro com consentimento LGPD e opção de anonimização.</p>
        </div>
        <Button className="gradient-emerald text-white" onClick={() => setOpen(true)} data-testid="new-customer-button">
          <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Novo Cliente
        </Button>
      </div>

      <Card className="glass border-white/5">
        <CardContent className="p-0">
          <table className="w-full text-sm" data-testid="customers-table">
            <thead>
              <tr className="text-left label-mono border-b border-white/5">
                <th className="p-4">CLIENTE</th>
                <th className="p-4">DOCUMENTO</th>
                <th className="p-4">CONTATO</th>
                <th className="p-4">CIDADE/UF</th>
                <th className="p-4">LGPD</th>
                <th className="p-4">CRIADO</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <Users className="w-8 h-8 mx-auto opacity-30 mb-2" strokeWidth={1.5} />
                  <div className="text-muted-foreground">Nenhum cliente ainda. Converta um lead ou cadastre manualmente.</div>
                </td></tr>
              ) : items.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`customer-row-${c.id}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {c.person_type === "PJ" ? <Building2 className="w-4 h-4 text-indigo-400" strokeWidth={1.75} /> : <User className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />}
                      <span className={`font-medium ${c.anonymized ? "italic text-muted-foreground" : ""}`}>{c.name}</span>
                      {c.anonymized && <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-300">ANON</Badge>}
                    </div>
                  </td>
                  <td className="p-4 mono text-muted-foreground">{c.document || "—"}</td>
                  <td className="p-4 text-xs">
                    <div>{c.email || "—"}</div>
                    <div className="text-muted-foreground mono">{c.phone || ""}</div>
                  </td>
                  <td className="p-4 text-xs">{c.city ? `${c.city}/${c.state || ""}` : "—"}</td>
                  <td className="p-4">
                    {c.lgpd_consent ? (
                      <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px]">
                        <Shield className="w-3 h-3 mr-1" strokeWidth={2} /> ACEITO
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">PENDENTE</Badge>
                    )}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                  <td className="p-4 text-right">
                    {!c.anonymized && (
                      <Button variant="ghost" size="sm" className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10" onClick={() => setConfirmAnon(c.id)} data-testid={`anonymize-${c.id}`}>
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} /> Anonimizar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-white/10 max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo Cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="label-mono">TIPO</Label>
              <Select value={form.person_type} onValueChange={(v) => setForm({ ...form, person_type: v })}>
                <SelectTrigger data-testid="cust-person-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PF">Pessoa Física</SelectItem><SelectItem value="PJ">Pessoa Jurídica</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="label-mono">NOME / RAZÃO SOCIAL</Label><Input data-testid="cust-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="label-mono">{form.person_type === "PJ" ? "CNPJ" : "CPF"}</Label><Input data-testid="cust-document" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div><Label className="label-mono">EMAIL</Label><Input data-testid="cust-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="label-mono">TELEFONE</Label><Input data-testid="cust-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label className="label-mono">CEP</Label><Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} /></div>
            <div className="col-span-2"><Label className="label-mono">ENDEREÇO</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label className="label-mono">CIDADE</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label className="label-mono">UF</Label><Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
            <div><Label className="label-mono">CÓDIGO IBGE</Label><Input placeholder="7 dígitos" value={form.ibge_code} onChange={(e) => setForm({ ...form, ibge_code: e.target.value })} /></div>
          </div>
          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-white/5 cursor-pointer">
            <Checkbox checked={form.lgpd_consent} onCheckedChange={(v) => setForm({ ...form, lgpd_consent: !!v })} data-testid="cust-lgpd-consent" />
            <div className="text-xs text-muted-foreground">
              <div className="text-white font-semibold mb-1 flex items-center gap-1"><Shield className="w-3 h-3" strokeWidth={2} /> Consentimento LGPD</div>
              Autorizo o armazenamento e tratamento dos meus dados pessoais para fins comerciais e fiscais, conforme a Lei Geral de Proteção de Dados.
            </div>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-emerald text-white" onClick={save} disabled={!form.name} data-testid="save-customer-button">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAnon} onOpenChange={(o) => !o && setConfirmAnon(null)}>
        <AlertDialogContent className="glass-strong border-rose-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" strokeWidth={2} /> Anonimizar cliente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Vamos mascarar nome, CPF/CNPJ, e-mail, telefone e endereço.
              O histórico de pedidos e notas fiscais é preservado para fins fiscais/contábeis (Art. 16 LGPD).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-500 hover:bg-rose-600" onClick={anonymize} data-testid="confirm-anonymize">
              Anonimizar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
