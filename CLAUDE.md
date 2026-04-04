@AGENTS.md

# revauniversity.online — Project Context for Claude

## Overview
Academic SaaS platform for Reva University students. Phase 1 covers CSE and CNIT departments.
Source of truth: `revauniversity_build_spec_v1.1.docx` (spec, business rules, DB schema, access control) and `revauniversity_payment_appendix_P.docx` (Razorpay integration).

## Stack
- **Next.js 16.2.2** — App Router, Turbopack
- **Supabase** — PostgreSQL + Auth + Storage + RLS + pg_cron (project ref: `ljlakjgwaxyngsppsnek`)
- **Razorpay** — payments (NOT Stripe). UPI 0% MDR.
- **Anthropic Claude API** — Q&A and topic extraction (model from `app_config`)
- **pdf-parse** — server-side text extraction; **tesseract.js** — OCR fallback
- **react-pdf** — PDF viewer (no download/print controls)

## Critical Next.js 16 differences
- Middleware file is `proxy.ts`, not `middleware.ts`
- Export must be `export async function proxy()`, not `export default` or `export function middleware`
- Always read `node_modules/next/dist/docs/` before writing any Next.js-specific code

## Project structure
```
proxy.ts                          # Middleware (Next.js 16 — named "proxy")
app/
  layout.tsx                      # Root layout — forces light mode, Geist font
  globals.css                     # Brand CSS vars; forces color-scheme: light
  page.tsx                        # Landing page (/)
  auth/callback/route.ts          # Supabase email confirmation (PKCE + token_hash)
  (auth)/
    layout.tsx
    login/page.tsx
    signup/page.tsx + SignupForm.tsx
  (dashboard)/
    layout.tsx                    # Auth guard + nav header (dashboard layout)
    dashboard/
      page.tsx                    # Dashboard home
      settings/page.tsx + SemesterUpdateForm.tsx
    subject/[id]/page.tsx         # Subject content viewer
    mock-paper/[id]/page.tsx      # Mock paper viewer
  admin/
    layout.tsx                    # Admin auth guard
    page.tsx                      # Admin home
    departments/page.tsx + DepartmentToggle.tsx
    subjects/page.tsx + AddSubjectForm.tsx
    materials/page.tsx + MaterialRow.tsx
    upload/page.tsx + UploadForm.tsx
    mock-papers/page.tsx + AddMockPaperForm.tsx
  api/
    auth/signup/route.ts
    payment/create-order/route.ts
    payment/webhook/route.ts      # export const runtime = 'nodejs' required
    payment/status/route.ts
    content/material/[id]/signed-url/route.ts
    content/mock-paper/[id]/route.ts
    qa/route.ts
    config/route.ts
    user/update-semester/route.ts
    admin/upload/route.ts
    admin/subjects/route.ts
    admin/departments/route.ts
    admin/mock-papers/route.ts
    admin/materials/[id]/route.ts
lib/
  supabase/client.ts              # Browser client (anon key only)
  supabase/server.ts              # Server client (@supabase/ssr + cookies)
  supabase/admin.ts               # service_role client — NEVER import in client components
  app-config.ts                   # getConfig() — always use, never hardcode values
  access-control.ts               # canAccessMaterial(), canAccessMockPaper(), etc.
  razorpay.ts                     # Server-only Razorpay client
supabase/migrations/
  001_initial_schema.sql          # All 9 tables, RLS, trigger, claim_early_user_slot()
  002_cron_jobs.sql               # pg_cron jobs (requires pg_cron enabled)
  003_storage_buckets.sql         # materials + mock-papers private buckets
```

## Business rules (from spec Section 2 — these override everything)
- **Prices/limits always from `app_config` table** — never hardcode
- **Payment/access logic server-side only** — never trust client
- **`subscription_semester` is immutable** after first write — enforced by DB trigger `enforce_subscription_semester_immutable`
- **Early user slots** claimed atomically via `claim_early_user_slot()` RPC — never read-then-write
- **`is_free` set by `unit_no`** automatically (unit 1 = free) — admins cannot override (Rule F2)
- **Soft-archive old materials** before inserting new one for same subject+unit (Rule F4 — no hard deletes)
- **Signed URLs for PDFs** — 5-min expiry, never cache client-side, never expose raw `file_url`
- **Webhook idempotency** — `razorpay_payment_id` UNIQUE constraint, ON CONFLICT DO NOTHING
- **Admin role** checked on every request (Rule G2) via `user.app_metadata?.role`
- **`RAZORPAY_KEY_SECRET`** never goes to the client — only `keyId` returned from create-order
- **`supabaseAdmin`** (service_role) never imported in client components

## Brand / UI
- Orange: `#F07B10` (`--reva-orange`)
- Teal: `#1B9E8B` (`--reva-teal`)
- Navy: `#1A2B4A` (`--reva-navy`)
- BG: `#F5F6FA` (`--reva-bg`)
- **Force light mode everywhere** — `color-scheme: light !important` on `:root`, `html`, `body`; hardcoded `#F5F6FA` background with `!important` in globals.css and root layout

## Auth flow
- Supabase email auth supports **both** PKCE (`code`) and `token_hash` flows — `/auth/callback` handles both
- Auth callback is **idempotent** — checks for existing users row before inserting
- Dashboard has **profile fallback** — if users row missing (auth callback failed), creates it on-the-fly from `user_metadata` to prevent redirect loop
- Proxy skips authenticated-user redirect when `?error=` param present (prevents loop when profile is broken)

## Upload flow — image/scan PDFs
- Admin upload form (`UploadForm.tsx`) has an **"Image/Scan PDF" checkbox**
- When checked, `isImagePdf=true` is sent in FormData to `/api/admin/upload`
- API skips setting `needs_ocr = true` when `isImagePdf` is true — no OCR warning for scanned mock papers/PYQs
- Normal flow: if extracted text < 100 chars → `needs_ocr = true` → admin panel flags it for review

## Supabase migration notes
- 001 (schema) → 002 (cron, requires pg_cron enabled) → 003 (storage)
- pg_cron must be enabled in Supabase dashboard before pushing 002
- Use `supabase migration repair --status applied <migration>` to manage history if needed
- Storage buckets created via SQL (`storage.buckets` INSERT) — CLI `--no-public` flag not supported

## Deployment / env
- `.env.local` needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `ANTHROPIC_API_KEY`
- Supabase URL: `https://ljlakjgwaxyngsppsnek.supabase.co`
- Razorpay and Anthropic keys must be filled in from their respective dashboards

## Known fixes applied
- Dark mode: added `color-scheme: light !important` globally
- Signup "Coming Soon": `UPDATE departments SET is_active = true WHERE name IN ('CSE', 'CNIT')`
- Auth `missing_code`: callback now handles `token_hash + type` (OTP) flow in addition to PKCE `code`
- Dashboard redirect loop: profile created on-the-fly; proxy skips redirect when `?error=` present
- Build error: `proxy.ts` must export `async function proxy`, not `middleware`
- Sai Pranav's admin account: manual users row insert + `raw_app_meta_data.role = 'admin'` via CLI
