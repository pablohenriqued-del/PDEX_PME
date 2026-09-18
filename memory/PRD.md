# NexusERP PME — PRD

## Original Problem Statement
Criar o sistema ERP mais moderno e mais bonito do mundo para PMEs brasileiras. Stack: FastAPI + Postgres + React. Escopo: 7 módulos completos.

## Stack
- Backend: FastAPI + SQLAlchemy 2 async + asyncpg + Postgres 15
- Auth: JWT Bearer + bcrypt
- Frontend: React 19 + Tailwind + shadcn/ui + Recharts + Framer Motion
- Design: Dark-first, Plus Jakarta Sans, Emerald + Indigo, glass surfaces

## User Personas
- **Admin/Owner (Pablo)**: vê tudo, gerencia usuários, produtos, fiscal, dashboard consolidado
- **Vendedor**: vê apenas seus próprios leads/pedidos, opera CRM Kanban + fecha vendas

## Entities
users, leads, lead_messages, customers, products, orders, order_items, payments, invoices, invoice_taxes, evolution_config

## Modules — Implemented (Feb 2026)
1. **Fundação**: JWT auth com RBAC (admin/vendedor), seed pablohenriqued@gmail.com como admin
2. **CRM Kanban**: 6 colunas (Novo, Em Contato, Qualificado, Proposta, Ganho, Perdido), drag-and-drop, painel lateral com histórico
3. **Integração WhatsApp**: Webhook Evolution API (auto-cria lead), envio de mensagens (mockado quando não configurado)
4. **Catálogo + Vendas**: Produtos e serviços, pedidos com itens, conversão lead→cliente→pedido, pagamentos (Pix/cartão/boleto)
5. **Fiscal**: Motor mock configurável (ICMS/PIS/COFINS/ISS/IPI) por percentuais em .env, emissão NF-e/NFS-e, invoice_taxes com breakdown
6. **Dashboard financeiro**: Faturamento bruto/líquido, evolução mensal (Recharts), tributos por tipo, contas a receber
7. **RBAC + LGPD**: Vendedor vê apenas próprios registros, admin vê tudo. Consentimento LGPD no cadastro cliente, anonimização com máscara CPF/telefone/email

## Backlog (P1)
- Conectar Evolution API real (usuário fornece URL + key nas configurações)
- Conectar motor fiscal real (Focus NFe/devnota) — hoje é mock configurável
- Exportação de relatórios CSV/PDF
- Multi-empresa (multi-tenant)
- Notificações in-app e por email
