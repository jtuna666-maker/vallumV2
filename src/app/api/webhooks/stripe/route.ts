
import { NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-07-29.dahlia" as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;
  let event: Stripe.Event;

  // 1. Verify the ping actually came from Stripe
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // 2. Listen for a successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Retrieve custom metadata you passed during checkout (like the book PDF URL)
    const { projectId, pdfUrl } = session.metadata || {};
    const shippingDetails = session.collected_information?.shipping_details;

    console.log(`Payment successful for project ${projectId}. Triggering print API...`);

    // 3. Send the order to Lulu (or Bookvault)
    try {
      const luluResponse = await fetch("https://api.lulu.com/print-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.LULU_API_TOKEN}`,
        },
        body: JSON.stringify({
          contact_email: session.customer_details?.email,
          line_items: [{
            title: "VELLUM Memoir",
            file_url: pdfUrl,
            quantity: 1,
            pod_package_id: "0600X0900BWSTDPB060UW444MXX" // Example Lulu print specs
          }],
          shipping_address: {
            name: shippingDetails?.name,
            street1: shippingDetails?.address?.line1,
            street2: shippingDetails?.address?.line2,
            city: shippingDetails?.address?.city,
            state: shippingDetails?.address?.state,
            postcode: shippingDetails?.address?.postal_code,
            country: shippingDetails?.address?.country,
          },
          shipping_level: "MAIL", 
        }),
      });

      if (!luluResponse.ok) {
        throw new Error("Failed to send order to Lulu");
      }
    } catch (error) {
      console.error("Fulfillment error:", error);
      // Stripe will retry the webhook if you return an error status
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
    }
  }

  // 4. Tell Stripe everything is good
  return NextResponse.json({ received: true }, { status: 200 });
}
