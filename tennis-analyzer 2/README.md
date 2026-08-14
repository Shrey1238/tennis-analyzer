# Tennis Swing Analyzer — Prototype (Step 2)

## Project structure

```
tennis-analyzer/
├── web/
│   └── index.html          ← the actual app (this is what gets hosted)
├── supabase/
│   └── functions/          ← Edge Functions (deployed via Supabase CLI, not hosting)
├── supabase-schema.sql     ← run once in Supabase's SQL Editor
├── PRIVACY_POLICY.md       ← template, needs legal review (see file)
├── TERMS_OF_SERVICE.md     ← template, needs legal review (see file)
├── vercel.json / netlify.toml  ← hosting config, see "Hosting" section below
└── README.md
```

The frontend (`web/index.html`) and the backend pieces (Supabase database
+ Edge Functions) are deployed separately, to different places — that's
normal for this kind of app, not a mistake. Hosting (Vercel/Netlify) only
ever touches the `web/` folder.

Builds on the pose-tracking prototype by adding a full analysis pass:
estimated racket-hand speed, a few technique metrics at the estimated
contact point, and plain-English feedback.

## Camera assumption (important)

This version assumes the clip is filmed **from the side**, roughly
perpendicular to the swing direction, with the player fully in frame
(including feet), and standing still and upright for at least a moment
early in the clip (e.g. the ready position). That upright moment is used
to calibrate pixels-to-real-world-distance using your height.

## What's new vs. step 1

- **Height input** — used to convert pixel movement into real speed.
- **"Analyze Swing" button** — instead of just tracking in real time, this
  steps through the whole video frame-by-frame (via seeking, not live
  playback) so it doesn't drop fast-motion frames the way real-time
  tracking can.
- **Estimated racket-hand speed** — right-wrist speed, peak value across
  the clip, shown in mph and km/h.
- **Contact-point metrics** — the frame with peak wrist speed is treated
  as a proxy for ball contact (there's no ball tracking yet), and from
  that frame:
  - Elbow angle
  - Front-knee bend (whichever leg is more bent — a simple heuristic,
    not a real stance detector yet)
  - Torso lean from vertical
- **Feedback list** — each metric now gets a short "what it means" explanation,
  your measured value, and a verdict (Good / Likely worth adjusting / Worth
  checking / Depends on intent) — not just a bare number.
- **"Play With Overlay"** button still there for a real-time visual
  sanity check, separate from the analysis pass.

## How to run it

1. Open `web/index.html` in Chrome, Edge, or Firefox.
2. Wait for "Model ready."
3. Enter your height in cm.
4. Upload a clip (side view, full body in frame, standing upright briefly
   near the start).
5. Click "Analyze Swing" and wait for the progress bar — this processes
   every frame, so it takes longer than real time, especially for longer
   clips.
6. Review the metrics and feedback list.

## Honest limitations of this pass

- **Speed accuracy** depends entirely on the height calibration and
  camera being roughly perpendicular to the swing — off-axis camera
  angles will skew it. Treat the number as a rough estimate, not a radar
  gun reading.
- **"Contact" detection** is just "peak wrist speed" — no ball tracking,
  so it can land a frame or two off the real contact moment.
- **Front-knee detection** just picks whichever knee is more bent — it
  doesn't actually know which foot is forward. Fine for a v1 proxy, not
  a real stance model.
- **Feedback thresholds are placeholder heuristics** I put together for
  this prototype, not verified coaching standards. Worth validating
  against real technique references (a coach, a book, established
  biomechanics research) before trusting the specific angle cutoffs.
- Still single-person tracking only.

## New: progress tracking (pro-tier concept)

Every time you run "Analyze Swing," the result is saved (currently just to
this browser's local storage) and shown in a "Your progress" table below
the report, with an optional session label (e.g. "forehand", "Tue
practice"). Arrows show whether each metric went up or down since your
last session — for speed, green means faster; for the angle-based metrics
(elbow, knee, torso lean), the arrows just show direction of change, not
"better," since those have an ideal range rather than a "more is always
better" relationship.

This is meant as a working demo of the single feature most likely to make
someone pay for a "pro" tier: turning a one-off analysis into a story
about improvement over time. A real pro version would sync this to a
user account (so it survives across devices and browser data getting
cleared) and show it as actual trend charts rather than a table — this
version proves the underlying idea cheaply, without needing a backend.

Note: this data currently lives only in your browser's local storage —
clearing browser data will erase it, and it won't follow you to another
device or browser. That's the exact gap a real backend/account system
would close.

## New: free-tier gating demo (fake accounts/payments)

The app now demonstrates the funnel you described: 1 free analysis with no
account, 1 more free analysis after a (fake) account is created, then a
(fake) subscription or pay-per-analysis after that. A "Plan" banner at the
top shows your current status, and a "Reset demo state" button lets you
replay the whole flow without clearing your browser manually.

**This is entirely a mockup** — clearly labeled as such in the app itself.
No real accounts are created, no real emails are stored anywhere, no real
payment is processed. It's meant to let you feel out whether the *flow*
(anonymous → account → paywall) feels right before investing in a real
backend, auth system, and payment processor (e.g. Stripe) to enforce it
for real. As-is, anyone could bypass all of this instantly by clearing
their browser's local storage — that's expected and fine for a UX demo,
but not something to treat as real enforcement.

## New: real accounts and database (Supabase)

Accounts, plan/usage tracking, and swing history are no longer a
local-storage mockup — they're backed by a real Supabase project. Payments
are still a placeholder (clicking "Subscribe" or "Pay once" just flips a
flag) — real Stripe billing is the next build step.

### One-time setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In your project's **SQL Editor**, paste in and run everything in
   `supabase-schema.sql` (included alongside this file). This creates the
   `user_plan` and `swings` tables, locks them down with row-level
   security so users can only ever see their own data, and sets up a
   trigger that auto-creates a plan row the moment someone signs up.
3. Go to **Project Settings → API** and copy your **Project URL** and
   **anon public key**.
4. Open `web/index.html` and near the top of the `<script type="module">`
   block, replace:
   ```js
   const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
   const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```
   with your actual values.
5. Email auth is on by default in Supabase — no extra config needed for
   basic email/password sign-up.

The anon key is safe to leave in client-side code — Supabase's row-level
security (set up by the SQL script) is what actually keeps each user's
data private, not keeping the key secret.

### What's real now vs. still placeholder

- **Real**: sign-up, sign-in, sessions that persist across refreshes,
  free-use tracking, swing history — all stored in Postgres, all
  protected by row-level security.
- **Real (new)**: Stripe payments. Subscribing or paying for a single
  analysis redirects to Stripe's actual hosted checkout page; a webhook
  confirms the payment happened before granting access — the browser
  can never grant itself premium/credits on its own.

## Real payments (Stripe)

Two new files handle this, both meant to be deployed as Supabase Edge
Functions (small server-side functions — this is the "server" mentioned
earlier that has to exist somewhere the user can't edit):

- `supabase/functions/create-checkout-session/index.ts` — called when the
  user clicks Subscribe or Pay Once; creates a real Stripe Checkout
  session and returns its URL.
- `supabase/functions/stripe-webhook/index.ts` — Stripe calls this
  directly (not your app) the moment a payment actually succeeds. This is
  the *only* place that flips `premium` or adds a `credit` in the
  database — which is what makes it real enforcement instead of
  something a user could fake from their browser's dev console.

### Setup steps

1. **Install the Supabase CLI** if you don't have it (`npm install -g
   supabase`), then from this project folder run `supabase login` and
   `supabase link --project-ref YOUR_PROJECT_REF` (find your project ref
   in the Supabase dashboard URL).
2. **Create a Stripe account** at stripe.com if you don't have one.
3. **Create two Prices** in the Stripe Dashboard (Product catalog →
   Add product):
   - A recurring monthly price (e.g. $6.99/mo) for Premium.
   - A one-time price (e.g. $1.49) for a single analysis.
   Copy each Price ID (starts with `price_...`).
4. **Set secrets** for the Edge Functions:
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set STRIPE_PRICE_SUBSCRIPTION=price_...
   supabase secrets set STRIPE_PRICE_ONETIME=price_...
   supabase secrets set APP_URL=https://your-deployed-app-url
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   (Service role key is in Project Settings → API — keep it secret, it
   bypasses row-level security by design, which is exactly what the
   webhook needs since Stripe, not a logged-in user, is calling it.)
5. **Deploy both functions**:
   ```
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   (`--no-verify-jwt` on the webhook because Stripe calls it directly,
   not a signed-in user.)
6. **Register the webhook in Stripe**: Dashboard → Developers → Webhooks
   → Add endpoint. Use the URL Supabase gives you after deploying
   `stripe-webhook` (looks like
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`).
   Subscribe to the `checkout.session.completed` event. Stripe will show
   you a signing secret — set it too:
   ```
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```
7. Test with Stripe's test mode and test card numbers (e.g.
   `4242 4242 4242 4242`) before ever switching to live keys.

## Hosting (Vercel or Netlify)

Right now this only exists on your computer. Hosting it turns it into a
real URL anyone (including you, from your phone) can open. Both options
below are free at this scale and need zero build step, since this is a
plain static HTML file.

### Option A: Vercel

1. `npm install -g vercel` (one-time).
2. From the `tennis-analyzer` project folder, run `vercel`. Follow the
   prompts (log in / create an account the first time).
3. It'll detect `vercel.json` and deploy the `web/` folder automatically.
4. You'll get a live URL like `https://tennis-analyzer-xyz.vercel.app`.
5. Run `vercel --prod` to make that URL permanent (the first deploy is a
   preview URL by default).

### Option B: Netlify

1. `npm install -g netlify-cli` (one-time).
2. From the project folder, run `netlify deploy`. Follow the prompts.
3. It'll use `netlify.toml` to know `web/` is the folder to publish.
4. Run `netlify deploy --prod` once you're happy, to make it permanent.

### Important: update APP_URL after your first deploy

The Stripe checkout function redirects back to whatever `APP_URL` is set
to in Supabase. Once you have a real hosted URL, update it:
```
supabase secrets set APP_URL=https://your-real-url.vercel.app
```
Otherwise Stripe will try to redirect users back to a placeholder URL
after checkout, which will fail.

### Ongoing updates

Both CLIs let you redeploy any time you change `web/index.html` by just
running the same deploy command again. For anything beyond occasional
manual redeploys, connecting the project to a GitHub repo (both Vercel
and Netlify support this) means every `git push` deploys automatically —
worth doing once you're iterating regularly instead of one-off testing.

## Legal (privacy policy + terms of service)

`PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md` are starting templates,
each with `[FLAG FOR LEGAL REVIEW]` markers at the specific points that
most need a real lawyer's attention before you rely on them — mainly:
- Exactly how you handle video (client-side only vs. ever touching your
  server) — this needs to be stated accurately, not just plausibly.
- Children's privacy, given tennis is commonly played by minors.
- The liability/disclaimer language, since this product gives physical
  technique feedback that could theoretically relate to injury if
  followed incorrectly.
- Your actual refund policy and governing jurisdiction.

Fill in the bracketed placeholders (`[YOUR COMPANY NAME]`,
`[YOUR CONTACT EMAIL]`, etc.) and resolve the flagged sections before
linking these from the app for real users, especially once real money is
involved.

## Putting this on GitHub

These commands run on your own computer, in the folder where you saved
these files (not in this chat) — you'll need [git](https://git-scm.com/)
installed and a free [GitHub](https://github.com) account.

1. **Create an empty repo on GitHub**: github.com → the "+" in the top
   right → "New repository." Give it a name (e.g. `tennis-analyzer`).
   Don't check any of the "initialize with README/gitignore" boxes —
   you already have those files locally.
2. **In the project folder on your computer**, run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tennis-analyzer.git
   git push -u origin main
   ```
   (GitHub shows you this exact set of commands, with your repo's real
   URL, right after you create the repo — you can copy them from there
   instead of retyping.)
3. Refresh the GitHub page — your files should now be there.

A `.gitignore` is already included so common junk (OS files, local env
files) doesn't get committed. **Nothing secret is in these files as
written** — the Supabase URL and anon key are safe to expose publicly by
design (row-level security is what actually protects data, not hiding
that key). Your real secrets (Stripe secret key, Supabase service role
key) only ever live in `supabase secrets set` commands you ran earlier —
never in a file — so there's nothing sensitive to worry about leaking
here.

### After it's on GitHub

This is what unlocks the "every push auto-deploys" setup mentioned in the
Hosting section above: in Vercel or Netlify, choose "Import from GitHub"
instead of deploying via CLI, point it at this repo, and it'll redeploy
automatically every time you push a change to `main`.

## Suggested next steps

1. Test the speed estimate against something with a known reference
   (e.g. a radar gun reading, or a controlled test where you know the
   racket head speed) to see how far off it tends to be.
2. Replace the peak-wrist-speed contact proxy with a smarter signal once
   you're ready to add ball tracking, or with a manual "mark contact
   frame" scrubber in the meantime.
3. Bring in real coaching thresholds (from a coach, book, or published
   biomechanics research) to replace the placeholder feedback rules.
4. Turn this into the real upload/results page — this file already
   separates "analyze" from "display," so the next step is mostly UI
   polish and possibly saving/comparing multiple swings over time.
