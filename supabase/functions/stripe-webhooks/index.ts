import "jsr:@supabase/functions-js@2.89.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.11.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const SITE_URL = (Deno.env.get("SITE_URL") ?? Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://devisfact.fr")
  .replace(/\/+$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase environment is not configured");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      throw new Error("Webhook secret not configured");
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log("Webhook event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const isPremium = session.metadata?.is_premium === "true";

        if (!userId) {
          console.error("No user_id in session metadata");
          break;
        }

        if (isPremium) {
          const premiumPlan = session.metadata?.premium_plan;
          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              stripe_premium_subscription_id: session.subscription as string,
              option_premium_active: true,
              type_premium: premiumPlan,
              date_debut_premium: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Premium option activated for user:", userId);
        } else {
          const plan = session.metadata?.plan;
          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              type_abonnement: plan,
              statut: "active",
              date_debut_abonnement: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Subscription activated for user:", userId);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) break;

        const userId = customer.metadata?.user_id;
        if (!userId) {
          console.error("No user_id in customer metadata");
          break;
        }

        const isPremiumSub = subscription.metadata?.is_premium === "true";

        if (isPremiumSub) {
          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              stripe_premium_subscription_id: subscription.id,
              option_premium_active: true,
              date_debut_premium: new Date(subscription.current_period_start * 1000).toISOString(),
              date_fin_premium: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Premium subscription created for user:", userId);
        } else {
          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              stripe_subscription_id: subscription.id,
              statut: "active",
              date_debut_abonnement: new Date(subscription.current_period_start * 1000).toISOString(),
              date_fin_abonnement: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Subscription created for user:", userId);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) break;

        const userId = customer.metadata?.user_id;
        if (!userId) {
          console.error("No user_id in customer metadata");
          break;
        }

        const { error: updateError } = await supabaseClient
          .from("abonnements")
          .update({
            statut: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        if (updateError) {
          throw new Error(updateError.message);
        }

        console.log("Invoice paid for user:", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) break;

        const userId = customer.metadata?.user_id;
        if (!userId) {
          console.error("No user_id in customer metadata");
          break;
        }

        const { data: abonnement, error: abonnementError } = await supabaseClient
          .from("abonnements")
          .select("stripe_subscription_id, stripe_premium_subscription_id")
          .eq("user_id", userId)
          .single();
        if (abonnementError) {
          throw new Error(abonnementError.message);
        }
        if (!abonnement) {
          throw new Error("Abonnement introuvable");
        }

        if (abonnement?.stripe_premium_subscription_id === subscription.id) {
          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              option_premium_active: false,
              stripe_premium_subscription_id: null,
              date_fin_premium: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Premium subscription canceled for user:", userId);
        } else {
          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              statut: "canceled",
              option_premium_active: false,
              date_fin_abonnement: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Subscription canceled for user:", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) break;

        const userId = customer.metadata?.user_id;
        if (!userId) {
          console.error("No user_id in customer metadata");
          break;
        }

        const { data: abonnement, error: abonnementError } = await supabaseClient
          .from("abonnements")
          .select("stripe_subscription_id, stripe_premium_subscription_id")
          .eq("user_id", userId)
          .single();
        if (abonnementError) {
          throw new Error(abonnementError.message);
        }
        if (!abonnement) {
          throw new Error("Abonnement introuvable");
        }

        const isPremiumSub = abonnement?.stripe_premium_subscription_id === subscription.id;

        if (isPremiumSub) {
          const premiumActive = subscription.status === "active";
          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              option_premium_active: premiumActive,
              date_fin_premium: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Premium subscription updated for user:", userId);
        } else {
          let statut = "active";
          if (subscription.status === "canceled" || subscription.status === "unpaid") {
            statut = "canceled";
          } else if (subscription.status === "past_due") {
            statut = "expired";
          }

          const { error: updateError } = await supabaseClient
            .from("abonnements")
            .update({
              statut: statut,
              date_fin_abonnement: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          if (updateError) {
            throw new Error(updateError.message);
          }

          console.log("Subscription updated for user:", userId);
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Webhook error:", message);
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
