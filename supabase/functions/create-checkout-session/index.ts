import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'npm:stripe@14.11.0';
import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Non authentifiÃ©');
    }

    const { plan } = await req.json();

    if (!plan || !['mensuel', 'annuel'].includes(plan)) {
      throw new Error('Plan invalide');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('raison_sociale, email_contact')
      .eq('id', user.id)
      .single();

    let customerId: string | undefined;

    const { data: subscription } = await supabaseClient
      .from('abonnements')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (subscription?.stripe_customer_id) {
      customerId = subscription.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: profile?.email_contact || user.email,
        metadata: {
          user_id: user.id,
          raison_sociale: profile?.raison_sociale || '',
        },
      });
      customerId = customer.id;

      await supabaseClient
        .from('abonnements')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    const priceId = plan === 'mensuel'
      ? Deno.env.get('STRIPE_PRICE_MONTHLY')
      : Deno.env.get('STRIPE_PRICE_ANNUAL');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/abonnement?success=true`,
      cancel_url: `${req.headers.get('origin')}/abonnement?canceled=true`,
      metadata: {
        user_id: user.id,
        plan: plan,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
