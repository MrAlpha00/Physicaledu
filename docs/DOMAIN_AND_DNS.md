# Domain and DNS

## Owner actions

1. Choose production domain/subdomain for VARSITY.
2. Configure DNS records at registrar/DNS provider.
3. Point domain to Vercel (or chosen host) per provider instructions.
4. Set `NEXT_PUBLIC_SITE_URL` to canonical HTTPS origin.
5. Configure Supabase Auth redirect URLs and site URL.
6. Configure Resend domain records.
7. Ensure TLS certificate active.

## Checks

- HTTPS enforced.
- `NEXT_PUBLIC_SITE_URL` matches canonical domain.
- QR codes and auth callbacks resolve to correct domain.
- No mixed-content/CSP violations after deployment.
