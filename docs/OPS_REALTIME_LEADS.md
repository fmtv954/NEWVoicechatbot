# Live lead feed requirements

The admin lead table now hydrates with server-rendered data and keeps itself in
sync through Supabase Realtime. Operations needs to double-check the following
configuration in each environment:

## Environment variables

- `SUPABASE_URL` – service endpoint used by server routes.
- `SUPABASE_SERVICE_ROLE_KEY` – service-role key with access to the `leads`
  table (used by the `/api/leads` route to return joined data).
- `NEXT_PUBLIC_SUPABASE_URL` – browser-safe URL exposed to the admin UI.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anon key with read access to the `leads`
  table and the `supabase_realtime` publication.

All four values must be present in `.env` / deployment secrets. The public keys
are loaded in the browser to power the realtime subscription; keep them scoped
to read-only privileges.

## Supabase realtime setup

1. In the Supabase dashboard, open **Database → Replication → Realtime**.
2. Add the `public.leads` table to the `supabase_realtime` publication with
   `INSERT`, `UPDATE`, and `DELETE` events enabled. (SQL equivalent:
   `alter publication supabase_realtime add table public.leads;`)
3. Ensure the anon role has `SELECT` rights on `public.leads` and any referenced
   foreign keys needed to build the admin view, or provide a dedicated read-only
   role.

Without the publication in step 2 the admin UI will render the initial data but
won't receive ongoing inserts/updates. Changes to the service-role key require a
redeploy so the server API can continue to hydrate joins for new events.
