
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { printOrders, projects } from "@/db/schema";
import { createPrintJob, isLuluConfigured } from "@/lib/lulu";
import { printKey } from "@/lib/pdf/source";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

function required(value: string | null | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      required(signature, "Stripe signature"),
      webhookSecret
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    console.error(`[vellum] Webhook signature verification failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const { orderId, projectId } = session.metadata || {};

  try {
    required(orderId, "orderId in Checkout metadata");
    required(projectId, "projectId in Checkout metadata");

    if (session.payment_status !== "paid") {
      console.log(
        `[vellum] Checkout ${session.id} completed with payment status ${session.payment_status}; fulfillment deferred.`
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const [order] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.id, orderId))
      .limit(1);
    if (!order || order.projectId !== projectId) {
      throw new Error(`Print order ${orderId} was not found for project ${projectId}`);
    }

    // Stripe retries successful Checkout events. Once a Lulu job is recorded,
    // acknowledge subsequent deliveries instead of creating a duplicate book.
    if (order.luluJobId || order.status === "fulfilled") {
      console.log(`[vellum] Order ${order.id} is already fulfilled; skipping retry.`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) throw new Error(`Project ${projectId} was not found`);

    const shipping = session.collected_information?.shipping_details;
    const address = shipping?.address;
    const contactEmail = required(
      session.customer_details?.email || order.email,
      "customer email"
    );

    await db
      .update(printOrders)
      .set({
        status: "paid",
        email: contactEmail,
        shipName: required(shipping?.name, "shipping name"),
        shipLine1: required(address?.line1, "shipping address line 1"),
        shipLine2: address?.line2 ?? "",
        shipCity: required(address?.city, "shipping city"),
        shipState: address?.state ?? "",
        shipPostal: required(address?.postal_code, "shipping postcode"),
        shipCountry: required(address?.country, "shipping country"),
        updatedAt: new Date(),
      })
      .where(eq(printOrders.id, order.id));

    if (!isLuluConfigured()) {
      throw new Error("Lulu credentials are not configured");
    }

    const origin = new URL(req.url).origin;
    const key = printKey(projectId);
    const edition = order.edition === "softcover" ? "softcover" : "heirloom";
    const pdfQuery = `edition=${edition}&k=${encodeURIComponent(key)}${event.livemode ? "" : "&sandbox=1"}`;

    console.log(`[vellum] Payment received for order ${order.id}; creating Lulu print job.`);
    const luluJobId = await createPrintJob({
      orderId: order.id,
      title: project.title,
      authorName: project.authorName,
      contactEmail,
      address: {
        name: required(shipping?.name, "shipping name"),
        street1: required(address?.line1, "shipping address line 1"),
        street2: address?.line2 ?? undefined,
        city: required(address?.city, "shipping city"),
        stateCode: address?.state ?? "",
        postcode: required(address?.postal_code, "shipping postcode"),
        countryCode: required(address?.country, "shipping country"),
        phoneNumber: session.customer_details?.phone ?? undefined,
      },
      interiorUrl: `${origin}/api/pdf/interior/${projectId}.pdf?${pdfQuery}`,
      coverUrl: `${origin}/api/pdf/cover/${projectId}.pdf?${pdfQuery}`,
      quantity: order.quantity,
      binding: edition,
      // A Stripe test event must never create a live print order, even if the
      // deployment's LULU_SANDBOX setting is accidentally configured for prod.
      environment: event.livemode ? undefined : "sandbox",
    });

    if (!luluJobId) throw new Error("Lulu created a print job without returning its ID");

    await db
      .update(printOrders)
      .set({ luluJobId, status: "fulfilled", updatedAt: new Date() })
      .where(eq(printOrders.id, order.id));

    console.log(`[vellum] Order ${order.id} fulfilled as Lulu job ${luluJobId}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[vellum] Fulfillment failed for Stripe event ${event.id}: ${message}`);
    // A non-2xx response asks Stripe to retry. The stored Lulu job ID makes a
    // successfully fulfilled order idempotent across those retries.
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

export const runtime = "nodejs";
