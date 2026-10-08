# games4james-backend

The Games4James API: Express 5 on AWS Lambda, data in Supabase Postgres via Drizzle, auth by Firebase ID tokens.

Everything a developer (or Claude) needs is in [CLAUDE.md](CLAUDE.md): commands, structure, the route map, the data layer and the rules. The plan for this code is in [docs/plan/06-sql-data-layer-supabase.md](../../docs/plan/06-sql-data-layer-supabase.md).

```bash
npm run server                               # from the repo root: http://localhost:8787
npm test                                     # all workspaces; API tests use in-process Postgres (pglite)
npm run db:migrate -w apps/backend-api       # apply drizzle/*.sql to DATABASE_URL_MIGRATIONS
npm run db:seed -w apps/backend-api          # games from the manifests + XP levels
npm run bundle -w apps/backend-api           # bundle.zip for Lambda (handler lambda.handler)
```
