import "server-only";
import {
  EDITIONS,
  formatUsd,
  quote,
  type EditionId,
  type Quote,
} from "@/lib/pricing";

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function getStripe() {
  const { default: Stripe } = await import("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
}

export type CheckoutSession = {
  url: string;
  sessionId: string;
};

/**
 * Builds a Stripe Checkout session for a physical edition.
 *
 * The unit price is always recomputed on the server from `lib/pricing` — the
 * client's quote is display-only, so a tampered request cannot buy an
 * heirloom below its profit floor.
 */
export async function createBookCheckout(args: {
  projectId: string;
  orderId: string;
  editionId: EditionId;
  quote: Quote;
  title: string;
  authorName: string;
  email?: string;
  origin: string;
}): Promise<CheckoutSession> {
  const stripe = await getStripe();
  const edition = EDITIONS[args.editionId];
  const q = args.quote;

  const discountNote =
    q.effectiveRate > 0
      ? ` — ${Math.round(q.effectiveRate * 100)}% volume discount applied (${q.break.label}).`
      : "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: args.email || undefined,
    shipping_address_collection: {
      allowed_countries: ["US", "CA", "GB", "AU", "NZ", "IE"],
    },
    line_items: [
      {
        quantity: q.quantity,
        price_data: {
          currency: "usd",
          // Stripe multiplies by quantity; we pass the discounted unit price.
          unit_amount: q.unitCents,
          product_data: {
            name: `${edition.name} — "${args.title}"`,
            description:
              `As told by ${args.authorName}. ${edition.tagline}` +
              discountNote +
              (q.quantity > 1 ? ` ${q.quantity} copies at ${formatUsd(q.unitCents)} each.` : ""),
          },
        },
      },
    ],
    metadata: {
      orderId: args.orderId,
      projectId: args.projectId,
      editionId: args.editionId,
      quantity: String(q.quantity),
      unitCents: String(q.unitCents),
    },
    success_url: `${args.origin}/app/project/${args.projectId}/preview?order=success`,
    cancel_url: `${args.origin}/app/project/${args.projectId}/preview?order=cancelled`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

export async function constructWebhookEvent(rawBody: string, signature: string) {
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET ?? ""
  );
}

export { quote, EDITIONS };
