import "jsr:@supabase/functions-js@2.89.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.11.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Non authentifiÃ©");
    }

    const { plan } = await req.json();

    if (!plan || !["mensuel", "annuel"].includes(plan)) {
      throw new Error("Plan premium invalide");
    }

    const { data: abonnement } = await supabaseClient
      .from("abonnements")
      .select("stripe_customer_id, statut")
      .eq("user_id", user.id)
      .single();

    if (!abonnement) {
      throw new Error("Abonnement introuvable");
    }

    if (abonnement.statut === "trial") {
      throw new Error("L'option premium n'est pas disponible pendant la pÃ©riode d'essai. Veuillez d'abord souscrire Ã  l'abonnement principal.");
    }

    if (abonnement.statut !== "active") {
      throw new Error("Votre abonnement principal doit Ãªtre actif pour souscrire Ã  l'option premium.");
    }

    if (!abonnement.stripe_customer_id) {
      throw new Error("Client Stripe introuvable");
    }

    const premiumPriceId = plan === "mensuel"
      ? Deno.env.get("STRIPE_PREMIUM_PRICE_MONTHLY")
      : Deno.env.get("STRIPE_PREMIUM_PRICE_ANNUAL");

    if (!premiumPriceId) {
      throw new Error("Les prix premium Stripe ne sont pas configurÃ©s. Veuillez configurer STRIPE_PREMIUM_PRICE_MONTHLY et STRIPE_PREMIUM_PRICE_ANNUAL.");
    }

    const session = await stripe.checkout.sessions.create({
      customer: abonnement.stripe_customer_id,
      payment_method_types: ["card"],
      line_items: [
        {
          price: premiumPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        metadata: {
          user_id: user.id,
          premium_plan: plan,
          is_premium: "true",
        },
      },
      success_url: `${req.headers.get("origin")}/abonnement?premium_success=true`,
      cancel_url: `${req.headers.get("origin")}/abonnement?premium_canceled=true`,
      metadata: {
        user_id: user.id,
        premium_plan: plan,
        is_premium: "true",
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
