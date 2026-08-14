// Supabase Edge Function: create-checkout-session
//
// Called from the app when the user clicks "Subscribe" or "Pay once".
// Creates a real Stripe Checkout session and returns its URL for the
// browser to redirect to. Runs server-side because it needs the Stripe
// *secret* key, which must never be shipped to the browser.
//
// Deploy with:  supabase functions deploy create-checkout-session
// Required secrets (set with `supabase secrets set KEY=value`):
//   STRIPE_SECRET_KEY        - from Stripe Dashboard > Developers > API keys
//   STRIPE_PRICE_SUBSCRIPTION - the Price ID for your monthly plan
//   STRIPE_PRICE_ONETIME       - the Price ID for a single analysis
//   APP_URL                  - where your app is hosted, e.g. https://yourapp.com
//   SUPABASE_URL / SUPABASE_ANON_KEY - already set automatically by Supabase

import Stripe from "npm:stripe@14?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Identify the signed-in user from the Authorization header the
    // Supabase client sends automatically with functions.invoke().
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode } = await req.json(); // "subscription" or "payment"
    if (mode !== "subscription" && mode !== "payment") {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = mode === "subscription"
      ? Deno.env.get("STRIPE_PRICE_SUBSCRIPTION")!
      : Deno.env.get("STRIPE_PRICE_ONETIME")!;
    const appUrl = Deno.env.get("APP_URL")!;

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      // Lets the webhook know which app-user this payment belongs to.
      client_reference_id: user.id,
      customer_email: user.email,
      success_url: `${appUrl}?checkout=success`,
      cancel_url: `${appUrl}?checkout=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
