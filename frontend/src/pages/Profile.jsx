import { useEffect, useState } from "react";
import api, { formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { User as UserIcon, KeyRound, Bell, Camera, ShieldCheck, Trash2 } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", avatar_url: "", notif_email: true, notif_inapp: true });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/auth/me").then(({ data }) => {
      setForm({
        name: data.name || "",
        phone: data.phone || "",
        avatar_url: data.avatar_url || "",
        notif_email: data.notif_email !== false,
        notif_inapp: data.notif_inapp !== false,
      });
    });
  }, []);

  const uploadAvatar = (file) => {
    if (!file) return;
    if (file.size > 400_000) {
      toast.error("Imagem muito grande (max 400KB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, avatar_url: reader.result });
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/auth/me", form);
      toast.success("Perfil atualizado");
    } catch (err) { toast.error(formatError(err)); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (pwd.new_password !== pwd.confirm) {
      toast.error("A confirmação não coincide");
      return;
    }
    try {
      await api.post("/auth/change-password", {
        current_password: pwd.current_password,
        new_password: pwd.new_password,
      });
      setPwd({ current_password: "", new_password: "", confirm: "" });
      toast.success("Senha alterada com sucesso");
    } catch (err) { toast.error(formatError(err)); }
  };

  const initials = (form.name || user?.email || "").slice(0, 2).toUpperCase();

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-4xl" data-testid="profile-page">
      <div>
        <div className="label-mono">MINHA CONTA</div>
        <h1 className="font-display font-extrabold text-4xl tracking-tight mt-1">Perfil e preferências</h1>
        <p className="text-muted-foreground text-sm mt-2">Atualize seus dados, foto e como quer ser notificado.</p>
      </div>

      <Card className="glass border-white/5">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center brand-glow">
              <UserIcon className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Dados pessoais</div>
              <div className="label-mono">NOME · TELEFONE · AVATAR</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-cyan-500/40">
                {form.avatar_url && <AvatarImage src={form.avatar_url} alt={form.name} />}
                <AvatarFallback className="text-xl gradient-brand text-white">{initials}</AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full gradient-brand cursor-pointer flex items-center justify-center brand-glow" title="Trocar foto">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadAvatar(e.target.files?.[0])}
                  data-testid="profile-avatar-input"
                />
              </label>
            </div>
            <div className="flex-1 space-y-3">
              <div><Label className="label-mono">NOME</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="profile-name-input" />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label className="label-mono">EMAIL</Label>
                  <Input value={user?.email || ""} disabled className="opacity-70" />
                </div>
                <div><Label className="label-mono">TELEFONE</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" data-testid="profile-phone-input" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 uppercase">{user?.role}</Badge>
                {user?.is_super_admin && <Badge variant="outline" className="border-violet-500/40 text-violet-300 uppercase gap-1"><ShieldCheck className="w-3 h-3" /> Super-admin</Badge>}
                {form.avatar_url && (
                  <button
                    onClick={() => setForm({ ...form, avatar_url: "" })}
                    className="ml-2 text-rose-300 hover:text-rose-200 flex items-center gap-1"
                    data-testid="profile-remove-avatar"
                  >
                    <Trash2 className="w-3 h-3" /> remover foto
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-white/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-300" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Preferências de notificação</div>
              <div className="label-mono">EMAIL · IN-APP</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-white/5">
            <div>
              <div className="text-sm font-medium">Notificações no app (sino)</div>
              <div className="text-xs text-muted-foreground">Receba alertas em tempo real de novos leads, pedidos pagos e estoque baixo.</div>
            </div>
            <Switch checked={form.notif_inapp} onCheckedChange={(v) => setForm({ ...form, notif_inapp: v })} data-testid="profile-notif-inapp" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-white/5">
            <div>
              <div className="text-sm font-medium">Notificações por email</div>
              <div className="text-xs text-muted-foreground">Resumos diários e alertas importantes chegam em <span className="mono">{user?.email}</span>.</div>
            </div>
            <Switch checked={form.notif_email} onCheckedChange={(v) => setForm({ ...form, notif_email: v })} data-testid="profile-notif-email" />
          </div>
          <div className="flex justify-end pt-2">
            <Button className="gradient-brand text-white brand-glow" onClick={saveProfile} disabled={saving} data-testid="profile-save">
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-white/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-rose-300" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Trocar senha</div>
              <div className="label-mono">SESSÃO ATUAL SERÁ MANTIDA</div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label className="label-mono">SENHA ATUAL</Label>
              <Input type="password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} data-testid="pwd-current" />
            </div>
            <div><Label className="label-mono">NOVA SENHA</Label>
              <Input type="password" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} data-testid="pwd-new" />
            </div>
            <div><Label className="label-mono">CONFIRMAR</Label>
              <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} data-testid="pwd-confirm" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              className="border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
              onClick={changePassword}
              disabled={!pwd.current_password || pwd.new_password.length < 6}
              data-testid="pwd-submit"
            >
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
