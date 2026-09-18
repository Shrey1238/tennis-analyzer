# Tennis Swing Analyzer

Browser-based tennis swing analyzer. Upload a clip, and it runs
[MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
over the video entirely in the browser, estimates peak racket-hand speed,
measures elbow angle / knee bend / torso lean at the estimated contact
point, and draws threshold-based feedback over the frame. Signed-in
users get a per-user swing history stored in Postgres (Supabase) behind
row-level security.

**Stack:** vanilla JavaScript (single `web/index.html`, no build step),
MediaPipe Tasks Vision (Pose Landmarker), Supabase (Postgres + Auth +
Edge Functions), Stripe.

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
+ Edge Functions) are deployed separately, to different places. Hosting
(Vercel/Netlify) only ever touches the `web/` folder.

## How it works

### 1. Frame-by-frame pose tracking (no live playback)

Running a pose model against a `<video>` element while it plays drops
frames whenever inference is slower than the frame rate — and it is
always slower during fast motion, which is exactly when a swing is
happening. Instead, `analyze()` steps through the clip by setting
`video.currentTime`, awaiting the `seeked` event, and then calling
`poseLandmarker.detectForVideo()` on the paused frame. Every sampled
frame is guaranteed to be processed.

Browsers don't expose a clip's native frame rate, so the pass steps at a
fixed 30 fps (`SAMPLE_FPS`), which matches the default recording rate on
most phones. Each step yields 33 normalized landmarks (x, y in `[0, 1]`).

### 2. Pixel → real-world calibration and peak wrist speed

Pose landmarks are in normalized image coordinates, so a speed in mph
needs a pixels-per-meter scale. The app finds the frame where the
nose-to-ankle span is largest — the most upright frame in the clip — and
sets that span equal to ~93% of the user-entered height (nose-to-ankle
is roughly 0.93 × standing height). That gives `metersPerPixel`.

Peak racket-hand speed is then the maximum of
`|Δ right-wrist (px)| × metersPerPixel / Δt` over consecutive sampled
frames, reported in mph and km/h. The frame at which it occurs is
treated as the contact-point proxy (no ball tracking).

### 3. Contact-point metrics, threshold feedback, canvas overlay

At the peak-wrist-speed frame the app computes:

- **Elbow angle** — shoulder–elbow–wrist angle on the racket arm.
- **Knee bend** — hip–knee–ankle angle of whichever knee is more bent
  (a simple front-leg heuristic).
- **Torso lean** — angle of the hip-midpoint → shoulder-midpoint vector
  from vertical.

`evaluateMetrics()` maps each to a verdict via fixed thresholds (e.g.
elbow `< 140°` → "Likely worth adjusting", `140–170°` → "Good",
`> 170°` → "Likely worth adjusting"). The same result drives two views:
a plain-English feedback list, and `drawContactOverlay()`, which freezes
the video on the contact frame and draws the skeleton, an arc at each
measured joint, and a color-coded label (value + verdict) on the canvas
overlay, plus the peak speed at the wrist.

### 4. Per-user swing history (Postgres + RLS)

Each analysis for a signed-in user is inserted into `public.swings`
(`supabase-schema.sql`). Row-level security is enabled on the table and
a single policy (`auth.uid() = user_id`) governs select/insert/update/
delete, so the browser only ever uses the public anon key and can still
only read or write the current user's rows. The "Your progress" table
reads back the same rows and shows direction-of-change arrows between
sessions.

## Camera assumptions

Film **from the side**, roughly perpendicular to the swing direction,
with the player fully in frame (including feet), standing upright for at
least a moment (e.g. the ready position) so calibration has a good frame.

## How to run it

1. Serve the `web/` folder (any static server, e.g. `python3 -m http.server -d web`)
   and open it in Chrome, Edge, or Firefox. Opening the file directly also works for
   analysis; Supabase auth needs an http(s) origin.
2. Wait for "Model ready."
3. Enter your height in cm.
4. Upload a clip, click "Analyze Swing", and wait for the progress bar —
   this processes every sampled frame, so it takes longer than real time.
5. Review the overlay, metrics, and feedback list.

## Known limitations

- **Speed accuracy** depends on the height calibration and the camera
  being roughly perpendicular to the swing — off-axis angles skew it.
  Treat the number as an estimate, not a radar-gun reading.
- **"Contact"** is peak wrist speed — no ball tracking, so it can land a
  frame or two off the real contact moment.
- **Front knee** is whichever knee is more bent; there is no stance model.
- **Feedback thresholds are heuristics**, not verified coaching
  standards. Validate the cutoffs against real technique references
  before trusting them.
- Right-handed players only (tracks the right wrist / right arm).
- Single-person tracking only.

## Accounts and database (Supabase)

Accounts, free-use tracking, and swing history are backed by a Supabase
project; payments go through Stripe (below).

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

### What's backed by a real service

- Sign-up, sign-in, sessions that persist across refreshes,
  free-use tracking, swing history — all stored in Postgres, all
  protected by row-level security.
- Stripe payments. Subscribing or paying for a single
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

## Suggested next steps

1. Test the speed estimate against something with a known reference
   (e.g. a radar gun reading, or a controlled test where you know the
   racket head speed) to see how far off it tends to be.
2. Replace the peak-wrist-speed contact proxy with a smarter signal once
   you're ready to add ball tracking, or with a manual "mark contact
   frame" scrubber in the meantime.
3. Bring in real coaching thresholds (from a coach, book, or published
   biomechanics research) to replace the placeholder feedback rules.
4. Add a left-handed toggle (mirror wrist/arm landmark selection).
5. Chart the swing history as trend lines instead of a table.
