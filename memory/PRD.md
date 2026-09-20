# PDEX ERP — PME · ERP · Sem Limites — PRD

## Original Problem Statement
Criar o sistema ERP mais moderno e mais bonito do mundo para PMEs brasileiras. Stack: FastAPI + Postgres + React. Escopo: 7 módulos completos.

## Brand Identity (Feb 2026)
- **Nome**: PDEX (iniciais PD do proprietário Pablo, + EX de expansão/experience)
- **Tagline**: PME · ERP · SEM LIMITES
- **Paleta brand**: Cyan `#22D3EE` → Blue `#3B82F6` → Violet `#8B5CF6` (gradiente diagonal)
- **Logo mark**: "X" formado por 2 barras diagonais em ret. arredondado dark navy (#0A1029)
- **Componentes**: `/app/frontend/src/components/PdexLogo.jsx` (PdexMark, PdexWordmark, PdexLogo)
- **Favicon**: `/app/frontend/public/favicon.svg`
- **CSS utilities**: `.gradient-brand`, `.gradient-brand-text`, `.brand-glow`
- **Copy branding**: cores emerald mantidas apenas para estados funcionais (sucesso/positivo); brand para logo/CTA principal

## Stack
- Backend: FastAPI + SQLAlchemy 2 async + asyncpg + Postgres 15
- Auth: JWT Bearer + bcrypt
- Frontend: React 19 + Tailwind + shadcn/ui + Recharts + Framer Motion
- Design: Dark-first, Plus Jakarta Sans, Emerald + Indigo, glass surfaces

## User Personas
- **Admin/Owner (Pablo)**: vê tudo, gerencia usuários, produtos, fiscal, dashboard consolidado
- **Vendedor**: vê apenas seus próprios leads/pedidos, opera CRM Kanban + fecha vendas
- **Contador**: acesso somente-leitura, exporta CSV/SPED, dashboard KPIs

## Public routes (Feb 2026)
- `/` — Marketing landing page (`Landing.jsx`) com hero, mockup dashboard live, 3 pilares (PME/ERP/∞), grid de 6 recursos, CTA final. Auto-redireciona autenticados para `/dashboard`.
- `/login` — Página de auth

## Entities
users, leads, lead_messages, customers, products, orders, order_items, payments, invoices, invoice_taxes, evolution_config

## Modules — Implemented (Feb 2026)
1. **Fundação**: JWT auth com RBAC (admin/vendedor/contador), seed pablohenriqued@gmail.com como admin
2. **CRM Kanban**: 6 colunas (Novo, Em Contato, Qualificado, Proposta, Ganho, Perdido), drag-and-drop, painel lateral com histórico
3. **Integração WhatsApp**: Webhook Evolution API (auto-cria lead), envio de mensagens (mockado quando não configurado)
4. **Catálogo + Vendas**: Produtos e serviços, pedidos com itens, conversão lead→cliente→pedido, pagamentos (Pix/cartão/boleto)
5. **Fiscal**: Motor mock configurável (ICMS/PIS/COFINS/ISS/IPI) por percentuais em .env, emissão NF-e/NFS-e, invoice_taxes com breakdown
6. **Dashboard financeiro**: Faturamento bruto/líquido, evolução mensal (Recharts), tributos por tipo, contas a receber
7. **RBAC + LGPD**: Vendedor vê apenas próprios registros, admin vê tudo. Consentimento LGPD no cadastro cliente + botão "Anonimizar" (máscara CPF/telefone/email, preserva histórico fiscal). Endpoint `POST /api/customers/{id}/anonymize`. Contador estritamente read-only via middleware.
8. **Landing pública**: Página `/` de marketing com identidade PDEX (hero, mockup live, pilares, features grid, CTA), redirecionamento automático para dashboard quando autenticado. Formulário "Solicitar demo" público (`POST /api/public/demo-request`) que cria lead com `source=Site` atribuído ao admin/tenant mestre — aparece direto no CRM Kanban na coluna Novo.
9. **Multi-tenant (isolamento completo)**: Modelo `Tenant`, coluna `tenant_id` em `users/leads/customers/orders/products` (com backfill idempotente no boot). Endpoints `/api/tenant/me` (GET/PATCH), `/api/tenant/members`, `/api/tenant/invite` (admin gera senha temporária). Todas as queries de leitura filtram por `tenant_id` (`_scope` helpers em leads/customers/orders/products routers). Validado: Acme Corp (tenant B) NÃO vê dados do PDEX Master; PDEX Master NÃO vê dados do Acme. JWT inclui tenant_id.
10. **SEO & Analytics**: index.html com Open Graph + Twitter Cards + og-image.svg 1200×630 + Plausible Analytics (`data-domain="pdex.com.br"`, tagged-events.outbound-links.js). Custom event "Demo Request" disparado em `submitDemo` com props company/has_phone.
11. **Logo animada**: `pdex-mark-anim` — continuous breathe 5.5s + spin 360° no hover, aplicado em todos os PdexMark do site.
12. **Multi-Tenant CRUD + Switcher (Feb 2026)**: `is_super_admin` flag em User (Pablo é o super-admin seed). Endpoints super-admin: `GET /api/tenants` (lista) e `POST /api/tenants` (cria tenant + admin com senha gerada). `POST /api/tenant/switch/{id}` retorna novo JWT scoped ao tenant alvo. Header ganhou `TenantSwitcher` (dropdown com nome atual, lista de tenants, Nova empresa modal). Vendedor/contador recebem 403.
13. **Onboarding Wizard (Feb 2026)**: `Tenant.onboarding_completed` bool. Ao logar em tenant novo, `OnboardingWizard` monta em Layout e abre modal de 4 passos (Empresa → Fiscal → Produto → Convite). "Finalizar depois" chama `POST /api/tenant/complete-onboarding`.
14. **Email transacional Resend (Feb 2026)**: Emergent-managed via `EMERGENT_EMAIL_KEY` + `EMAIL_FROM_NAME=PDEX`. `email_service.py` com guardrails G1-G5 (`_assert_safe_email` bloqueia forms/inputs, links non-https, impersonation). Template `render_invite_email` (dark navy + gradient CTA). Invite endpoint dispara email fire-and-forget — testado com `delivered@resend.dev` retornando `HTTP 202 Accepted`.
15. **Perfil do Admin (Feb 2026)**: User ganhou `phone`, `avatar_url` (Text, base64 data URL), `notif_email`, `notif_inapp`. Endpoints `GET/PATCH /api/auth/me` e `POST /api/auth/change-password`. Página `/profile` com upload de foto client-side (FileReader → base64, 400KB max), toggles de notificação, e troca de senha (valida senha atual). Item "Minha Conta" na sidebar.
16. **Audit Log (Feb 2026)**: Modelo `AuditEvent` (tenant_id, actor_id/email/role, action, resource_type, resource_id, summary, meta JSON, ip_address). Helper `audit_service.log_event` fail-soft chamado em login, register, patch me, change_password, create_lead, demo_request, create_tenant, tenant_switch. `GET /api/audit` — admin vê próprio tenant, super-admin vê todos, filtros por resource_type e action. Página `/audit` com tabela e filtros. Contador bloqueado (403).
17. **Notificações in-app (Feb 2026)**: `notify_tenant_admins(db, tenant_id, ...)` cria uma Notification por admin/contador do tenant, respeitando `notif_inapp` flag. `notify_super_admins(db, ...)` idem para o super-admin. Triggers ativos: create_lead → tenant admins, demo_request público → tenant admins + super_admins, create_tenant → super_admins. Sino do header exibe badge com contagem não-lida.
18. **Mobile drawer + swipe gesture (Feb 2026)**: `Sheet` shadcn abrindo pela esquerda em telas <1024px, com todos os itens da sidebar (nav + user card + logout). Botão hamburger no topo mobile. Gesture: swipe da borda esquerda (primeiros 24px, delta horizontal >= 60px, dominante) abre o drawer via `useEffect` de touch listeners em `window`. Barra vertical gradient brand como affordance visual no edge.

## Credentials scheme (Feb 2026)
- Admin: pablohenriqued@gmail.com / **PDEX@2026**
- Vendedores: `vendedor|ana|bruno|carla@pdex.com.br` / `<Nome>@PDEX2026`
- Contador: contador@pdex.com.br / Contador@PDEX2026
- Migração automática de @nexuserp.com → @pdex.com.br no boot via `seed.migrate_legacy_pdex_emails` (idempotente).

## Backlog (P1)
- Conectar Evolution API real (usuário fornece URL + key nas configurações)
- Conectar motor fiscal real (Focus NFe/devnota) — hoje é mock configurável
- Exportação de relatórios CSV/PDF
- Emails automáticos de convite (integrar Resend)
- Notificações in-app e por email
- CRUD de tenants (hoje só existe o default + criação via SQL para testes)
