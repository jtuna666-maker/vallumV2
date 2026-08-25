import "server-only";

/**
 * Lulu Print API integration — print-on-demand fulfillment for the keepsake.
 *
 * Requires LULU_CLIENT_KEY + LULU_CLIENT_SECRET (use sandbox creds while
 * testing: LULU_SANDBOX=1 hits https://api.sandbox.lulu.com and charges no one).
 * Without credentials, fulfillment is skipped gracefully and the order stays
 * "paid" awaiting manual handling.
 *
 * Lulu fetches print-ready PDFs from public URLs supplied by the caller (the
 * Stripe webhook passes this app's hosted interior/cover endpoints).
 */

const PROD = "https://api.lulu.com";
const SANDBOX = "https://api.sandbox.lulu.com";

function baseUrl(): string {
  return process.env.LULU_SANDBOX === "0" ? PROD : SANDBOX;
}

export function isLuluConfigured(): boolean {
  return Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET);
}

/**
 * 6×9, B&W interior on 60# cream (444 = uncoated white/cream, 060 = 60#).
 *  · HC = case-laminate hardcover for the HEIRLOOM edition
 *  · PB = perfect-bound paperback for the Keepsake Softcover
 */
const HARDCOVER_PACKAGE =
  process.env.LULU_PACKAGE_ID ?? "0600X0900BWSTDHC060UW444GXX";
const SOFTCOVER_PACKAGE =
  process.env.LULU_PACKAGE_ID_SOFT ?? "0600X0900BWSTDPB060UW444MXX";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${baseUrl()}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.LULU_CLIENT_KEY}:${process.env.LULU_CLIENT_SECRET}`
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Lulu auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export type LuluAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  stateCode: string;
  postcode: string;
  countryCode: string;
  phoneNumber?: string;
};

export async function createPrintJob(args: {
  orderId: string;
  title: string;
  authorName: string;
  contactEmail: string;
  address: LuluAddress;
  interiorUrl: string;
  coverUrl: string;
  quantity?: number;
  binding?: "softcover" | "heirloom";
}): Promise<string> {
  const token = await getToken();
  const res = await fetch(`${baseUrl()}/print-jobs/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contact_email: args.contactEmail,
      external_id: `vellum-${args.orderId}`,
      shipping_level: "GROUND",
      shipping_address: {
        name: args.address.name,
        street1: args.address.street1,
        street2: args.address.street2 ?? "",
        city: args.address.city,
        state_code: args.address.stateCode,
        postcode: args.address.postcode,
        country_code: args.address.countryCode,
        phone_number: args.address.phoneNumber ?? "",
      },
      line_items: [
        {
          external_id: `vellum-${args.orderId}-book`,
          title: args.title,
          quantity: Math.max(1, args.quantity ?? 1),
          printable_normalization: {
            cover: { source_url: args.coverUrl },
            interior: { source_url: args.interiorUrl },
            pod_package_id:
              args.binding === "softcover" ? SOFTCOVER_PACKAGE : HARDCOVER_PACKAGE,
          },
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Lulu print-job failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: number | string };
  return String(data.id ?? "");
}
