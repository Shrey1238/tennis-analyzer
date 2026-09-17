// Supabase Edge Function: stripe-webhook
//
// Stripe calls this directly (not the browser) when a checkout session
// completes. This is the only place that actually grants premium/credits —
// the browser can never grant itself access, since it never touches
// this endpoint or these secrets.
//
// Deploy with:  supabase functions deploy stripe-webhook --no-verify-jwt
// (--no-verify-jwt because Stripe, not a logged-in user, calls this)
//
// After deploying, copy the function's URL into Stripe Dashboard >
// Developers > Webhooks > Add endpoint, and subscribe to the
// "checkout.session.completed" event. Stripe will then give you a
// signing secret — set it as STRIPE_WEBHOOK_SECRET below.
//
// Required secrets:
//   STRIPE_SECRET_KEY         - same as the other function
//   STRIPE_WEBHOOK_SECRET     - from the Stripe webhook setup step above
//   SUPABASE_URL              - already set automatically
//   SUPABASE_SERVICE_ROLE_KEY - from Project Settings > API (NOT the anon key —
//                                this one bypasses row-level security, which
//                                is exactly what a trusted server needs and a
//                                reason this key must never reach the browser)

import Stripe from "npm:stripe@14?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Service-role client: full access, used only here, never sent to the browser.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;

    if (!userId) {
      console.error("Checkout session had no client_reference_id, cannot credit a user.");
      return new Response("ok", { status: 200 });
    }

    if (session.mode === "subscription") {
      const { error } = await supabaseAdmin
        .from("user_plan")
        .update({ premium: true, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) console.error("Failed to set premium:", error);
    } else if (session.mode === "payment") {
      // Read current credits, then increment — the service-role key
      // bypasses RLS so this is allowed even though it's not "this user's"
      // own request (there is no user request here; Stripe is calling us).
      const { data, error: readError } = await supabaseAdmin
        .from("user_plan")
        .select("credits")
        .eq("user_id", userId)
        .single();
      if (readError) {
        console.error("Failed to read credits:", readError);
      } else {
        const { error: writeError } = await supabaseAdmin
          .from("user_plan")
          .update({ credits: (data.credits ?? 0) + 1, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (writeError) console.error("Failed to add credit:", writeError);
      }
    }
  }

  return new Response("ok", { status: 200 });
});
