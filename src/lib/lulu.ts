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

// The sandbox is the default (anything other than "0"), so a production
// deploy that forgets LULU_SANDBOX=0 would silently "fulfill" every order in
// the sandbox — paid, but no book ever printed. Make that state loud.
if (process.env.NODE_ENV === "production" && process.env.LULU_SANDBOX !== "0") {
  console.error(
    "[vellum] LULU_SANDBOX is not \"0\" in production: print orders would go to the Lulu sandbox and no book would ever be printed. Set LULU_SANDBOX=0 before going live."
  );
}

export type LuluEnvironment = "sandbox" | "production";

function baseUrl(environment?: LuluEnvironment): string {
  if (environment === "sandbox") return SANDBOX;
  if (environment === "production") return PROD;
  return process.env.LULU_SANDBOX === "0" ? PROD : SANDBOX;
}

export function isLuluConfigured(): boolean {
  return Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET);
}

/**
 * 6×9, B&W interior on 60# cream (UC = uncoated cream, 060 = 60#).
 *  · CW = case-wrap hardcover for the HEIRLOOM edition
 *  · PB = perfect-bound paperback for the Keepsake Softcover
 */
const HARDCOVER_PACKAGE =
  process.env.LULU_PACKAGE_ID ?? "0600X0900.BW.STD.CW.060UC444.GXX";
const SOFTCOVER_PACKAGE =
  process.env.LULU_PACKAGE_ID_SOFT ?? "0600X0900.BW.STD.PB.060UC444.MXX";

export function luluPackageId(binding: "softcover" | "heirloom"): string {
  return binding === "softcover" ? SOFTCOVER_PACKAGE : HARDCOVER_PACKAGE;
}

/** Use the manufacturer's dimensions, not an approximate paper caliper. */
export async function getCoverDimensions(
  pageCount: number,
  binding: "softcover" | "heirloom",
  environment?: LuluEnvironment
): Promise<{ width: number; height: number }> {
  const token = await getToken(environment);
  const res = await fetch(`${baseUrl(environment)}/cover-dimensions/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      pod_package_id: luluPackageId(binding),
      interior_page_count: pageCount,
      unit: "pt",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Lulu cover dimensions failed: ${res.status} ${(await res.text()).slice(0, 500)}`);
  const data = await res.json() as { width: string; height: string };
  const width = Number(data.width);
  const height = Number(data.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Lulu returned invalid cover dimensions");
  }
  return { width, height };
}

const cachedTokens = new Map<string, { token: string; expiresAt: number }>();

async function getToken(environment?: LuluEnvironment): Promise<string> {
  const apiBase = baseUrl(environment);
  const cachedToken = cachedTokens.get(apiBase);
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${apiBase}/auth/realms/glasstree/protocol/openid-connect/token`, {
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
  cachedTokens.set(apiBase, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
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

type LuluShippingOption = {
  level: string;
  cost_excl_tax: number | string;
  is_active: boolean;
};

/** Ask Lulu which shipping levels are actually available for this book/address. */
async function getShippingLevel(args: {
  address: LuluAddress;
  pageCount: number;
  quantity: number;
  podPackageId: string;
  environment?: LuluEnvironment;
}): Promise<string> {
  const res = await fetch(`${baseUrl(args.environment)}/shipping-options/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currency: "USD",
      line_items: [
        {
          page_count: args.pageCount,
          pod_package_id: args.podPackageId,
          quantity: args.quantity,
        },
      ],
      shipping_address: {
        name: args.address.name,
        street1: args.address.street1,
        street2: args.address.street2 ?? "",
        city: args.address.city,
        state: args.address.stateCode,
        postcode: args.address.postcode,
        country: args.address.countryCode,
        phone_number: args.address.phoneNumber || undefined,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Lulu shipping-options failed: ${res.status} ${(await res.text()).slice(0, 500)}`);
  }
  const options = (await res.json()) as LuluShippingOption[];
  const available = options
    .filter((option) => option.is_active && option.level)
    .sort((a, b) => Number(a.cost_excl_tax) - Number(b.cost_excl_tax));
  if (!available[0]) throw new Error("Lulu returned no shipping options for this address");
  return available[0].level;
}

export async function createPrintJob(args: {
  orderId: string;
  title: string;
  authorName: string;
  contactEmail: string;
  address: LuluAddress;
  interiorUrl: string;
  coverUrl: string;
  pageCount: number;
  quantity?: number;
  binding?: "softcover" | "heirloom";
  /** Force a target for this job. Test Stripe events always pass "sandbox". */
  environment?: LuluEnvironment;
}): Promise<string> {
  const token = await getToken(args.environment);
  const quantity = Math.max(1, args.quantity ?? 1);
  const podPackageId = luluPackageId(args.binding ?? "heirloom");
  const shippingLevel = await getShippingLevel({
    address: args.address,
    pageCount: args.pageCount,
    quantity,
    podPackageId,
    environment: args.environment,
  });
  const res = await fetch(`${baseUrl(args.environment)}/print-jobs/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contact_email: args.contactEmail,
      external_id: `vellum-${args.orderId}`,
      shipping_level: shippingLevel,
      shipping_address: {
        name: args.address.name,
        street1: args.address.street1,
        street2: args.address.street2 ?? "",
        city: args.address.city,
        state_code: args.address.stateCode,
        postcode: args.address.postcode,
        country_code: args.address.countryCode,
        phone_number: args.address.phoneNumber || undefined,
      },
      line_items: [
        {
          external_id: `vellum-${args.orderId}-book`,
          title: args.title,
          quantity,
          printable_normalization: {
            cover: { source_url: args.coverUrl },
            interior: { source_url: args.interiorUrl },
            pod_package_id: podPackageId,
          },
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Lulu print-job failed: ${res.status} ${detail.slice(0, 1500)}`);
  }
  const data = (await res.json()) as { id?: number | string };
  return String(data.id ?? "");
}
