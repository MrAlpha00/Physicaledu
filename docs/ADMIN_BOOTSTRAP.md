# Initial PE Admin bootstrap

There is deliberately **no public admin registration form** and no hardcoded
admin email or password. Follow this procedure for the first administrator.

## 1. Create a normal account

Use the public `/register` page to create an ordinary student account for the
person who will administer PE. Complete any email confirmation.

## 2. Obtain the Auth user UUID

In the Supabase dashboard open **Authentication → Users**, find that account and
copy its **UUID**. Do not use the email address as the identifier in the SQL
below.

## 3. Assign the PE Admin role

Open **SQL Editor** and run the following, replacing only the placeholder with
the real UUID. Do not add passwords or secret values to this file.

```sql
-- Replace the placeholder below with the Auth user UUID from step 2.
with target_user as (
  select id
  from auth.users
  where id = '00000000-0000-0000-0000-000000000000'::uuid
)
insert into public.user_roles (user_id, role)
select id, 'pe_admin'
from target_user
on conflict (user_id, role) do nothing;
```

This operation is deliberately manual and must be performed by someone with
SQL/editor access to the Supabase project. Ordinary students have no policy
that permits inserting into `user_roles`, so they cannot grant themselves the
role through the application or API.

If you prefer to verify the assignment afterwards:

```sql
select user_id, role, created_at
from public.user_roles
where role = 'pe_admin';
```

## 4. Verify admin access

Sign in at `/login`. The account should land on `/admin/dashboard`. Confirm that:

- the metrics show live counts;
- **Admin → Students → PE Roster** is reachable;
- departments can be added and deactivated.

## 5. Verify student restrictions

Using a separate normal student account, confirm that:

- navigating directly to `/admin/dashboard` redirects to `/unauthorized`;
- the student dashboard shows their real verification and PE membership status;
- no admin controls are visible.

## Additional administrators

After the first admin exists, further role assignments should be performed with
the same controlled SQL procedure or a future audited admin function. Never
expose role assignment as an unrestricted form.
