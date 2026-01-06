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
      throw new Error("Non authentifie");
    }

    let returnUrl: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.returnUrl === "string") {
        returnUrl = body.returnUrl;
      }
    } catch {
      // No JSON body provided.
    }

    const { data: abonnement } = await supabaseClient
      .from("abonnements")
      .select("stripe_customer_id, statut, option_premium_active, stripe_premium_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (!abonnement) {
      throw new Error("Abonnement introuvable");
    }

    if (abonnement.statut === "trial") {
      throw new Error("L'option premium n'est pas disponible pendant la periode d'essai.");
    }

    if (abonnement.statut !== "active") {
      throw new Error("Votre abonnement principal doit etre actif pour gerer l'option premium.");
    }

    if (!abonnement.option_premium_active || !abonnement.stripe_premium_subscription_id) {
      throw new Error("Aucune option premium active.");
    }

    if (!abonnement.stripe_customer_id) {
      throw new Error("Client Stripe introuvable");
    }

    const origin = req.headers.get("origin") ?? "";
    const portalReturnUrl = returnUrl || `${origin}/abonnement`;

    const session = await stripe.billingPortal.sessions.create({
      customer: abonnement.stripe_customer_id,
      return_url: portalReturnUrl,
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
