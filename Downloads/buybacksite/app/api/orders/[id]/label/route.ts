/**
 * POST /api/orders/[id]/label
 *
 * Generates a prepaid return shipping label via the EasyPost API.
 * The label goes FROM the seller TO the shop (so the seller can ship for free).
 *
 * Requires:
 *  - EASYPOST_API_KEY in environment
 *  - Tenant NAP settings (shop address = "to" address)
 *  - Seller address provided in request body (not stored in DB schema)
 *
 * On success: saves shippingLabelUrl + trackingNumber to the Order row.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

interface LabelRequestBody {
  // Seller "from" address
  sellerStreet: string;
  sellerCity: string;
  sellerState: string;
  sellerZip: string;
  sellerName: string;
}

interface EasyPostAddress {
  name: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface EasyPostRate {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  delivery_days: number | null;
}

interface EasyPostShipment {
  id: string;
  rates: EasyPostRate[];
  postage_label?: { label_url: string };
  tracking_code?: string;
  selected_rate?: EasyPostRate;
}

async function easypostRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<T> {
  const apiKey = process.env.EASYPOST_API_KEY;
  if (!apiKey) throw new Error("EASYPOST_API_KEY is not configured");

  const res = await fetch(`https://api.easypost.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `EasyPost ${res.status}`);
  }

  return res.json() as Promise<T>;
}

async function createAddress(addr: EasyPostAddress) {
  return easypostRequest<{ id: string }>("/addresses", "POST", { address: addr });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { tenant: { include: { napSettings: true } } },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    order.tenantId !== session.user.tenantId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nap = order.tenant.napSettings;
  if (!nap) {
    return NextResponse.json(
      { error: "Shop address (NAP settings) not configured. Set it in Settings → Business Info." },
      { status: 422 }
    );
  }

  const body: LabelRequestBody = await req.json();
  const { sellerStreet, sellerCity, sellerState, sellerZip, sellerName } = body;

  if (!sellerStreet || !sellerCity || !sellerState || !sellerZip) {
    return NextResponse.json({ error: "Seller address is required" }, { status: 400 });
  }

  // If EASYPOST_API_KEY is not set, return a mock label for dev
  if (!process.env.EASYPOST_API_KEY) {
    const mockTracking = `MOCK${Date.now().toString(36).toUpperCase()}`;
    const updated = await db.order.update({
      where: { id: params.id },
      data: {
        shippingLabelUrl: "https://easypost.com/mock-label.pdf",
        trackingNumber: mockTracking,
        carrierName: "USPS (mock)",
      },
    });
    return NextResponse.json({
      labelUrl: updated.shippingLabelUrl,
      trackingNumber: updated.trackingNumber,
      carrier: "USPS (mock)",
      mock: true,
    });
  }

  try {
    // Create from address (seller)
    const fromAddr = await createAddress({
      name: sellerName,
      street1: sellerStreet,
      city: sellerCity,
      state: sellerState,
      zip: sellerZip,
      country: "US",
    });

    // Create to address (shop)
    const toAddr = await createAddress({
      name: nap.businessName,
      street1: nap.streetAddress,
      city: nap.city,
      state: nap.state,
      zip: nap.zipCode,
      country: "US",
    });

    // Create shipment — standard phone box dimensions
    const shipment = await easypostRequest<EasyPostShipment>("/shipments", "POST", {
      shipment: {
        from_address: { id: fromAddr.id },
        to_address: { id: toAddr.id },
        parcel: {
          length: 6,
          width: 3,
          height: 1,
          weight: 8, // ounces
        },
      },
    });

    // Pick cheapest USPS rate, fall back to absolute cheapest
    const rates = shipment.rates ?? [];
    const uspsRates = rates.filter((r) => r.carrier === "USPS");
    const sorted = (uspsRates.length ? uspsRates : rates).sort(
      (a, b) => parseFloat(a.rate) - parseFloat(b.rate)
    );
    const cheapestRate = sorted[0];
    if (!cheapestRate) {
      return NextResponse.json({ error: "No shipping rates available" }, { status: 422 });
    }

    // Buy the label
    const bought = await easypostRequest<EasyPostShipment>(
      `/shipments/${shipment.id}/buy`,
      "POST",
      { rate: { id: cheapestRate.id } }
    );

    const labelUrl = bought.postage_label?.label_url ?? "";
    const trackingNumber = bought.tracking_code ?? "";
    const carrier = bought.selected_rate?.carrier ?? cheapestRate.carrier;

    await db.order.update({
      where: { id: params.id },
      data: { shippingLabelUrl: labelUrl, trackingNumber, carrierName: carrier },
    });

    return NextResponse.json({ labelUrl, trackingNumber, carrier });
  } catch (err) {
    console.error("[EasyPost]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate label" },
      { status: 500 }
    );
  }
}
