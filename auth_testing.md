# NexusERP PME — Auth Testing Playbook

## Endpoints
- POST /api/auth/login (body: {email, password}) → {access_token, token_type, user}
- POST /api/auth/register (admin only, body: {email, password, name, role})
- GET  /api/auth/me (Bearer token)
- GET  /api/auth/users (admin only)

## Credentials
- Admin: pablohenriqued@gmail.com / NexusERP@2026
- Vendedor: vendedor@nexuserp.com / Vendedor@2026

## Manual Test
```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"pablohenriqued@gmail.com","password":"NexusERP@2026"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Notes
- JWT: HS256, exp 1440 min (24h), secret in JWT_SECRET .env
- Password hashing: bcrypt
- Role scoping enforced at router level (leads, customers, orders, dashboard filter by owner/seller if !admin)
- Seed re-updates password_hash if ADMIN_PASSWORD/.env changes → idempotent boot
