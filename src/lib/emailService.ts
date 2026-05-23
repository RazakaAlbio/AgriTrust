// =============================================================================
// emailService.ts
// Agri-Trust — EmailJS wrapper for dispute notifications
// Service ID: service_lkygbp3 (Gmail)
// =============================================================================

import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? "";
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? "";

// Template IDs — limited to 2 templates as requested
const TEMPLATE_CUSTOMER  = import.meta.env.VITE_EMAILJS_TEMPLATE_CUSTOMER  ?? "";
const TEMPLATE_FARMER    = import.meta.env.VITE_EMAILJS_TEMPLATE_FARMER    ?? "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Shorten a UUID to first 8 chars for display (e.g. #a1b2c3d4) */
export function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function init() {
  if (PUBLIC_KEY) emailjs.init(PUBLIC_KEY);
}

// ─── Email Senders ────────────────────────────────────────────────────────────

/**
 * Sent to the customer confirming their dispute was received.
 */
export async function sendDisputeConfirmation(params: {
  customer_email: string;
  customer_name: string;
  dispute_id: string;
  batch_id: string;
  dispute_type: string;
}): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_CUSTOMER) return;
  init();
  await emailjs.send(SERVICE_ID, TEMPLATE_CUSTOMER, {
    to_email:     params.customer_email,
    to_name:      params.customer_name,
    dispute_ref:  shortId(params.dispute_id),
    dispute_id:   params.dispute_id,
    batch_id:     params.batch_id,
    dispute_type: params.dispute_type,
    tracking_url: `${window.location.origin}/track/${params.dispute_id}`
  });
}

/**
 * Sent to the farmer when a dispute is filed against their batch.
 */
export async function sendFarmerNotification(params: {
  farmer_email: string;
  farmer_name: string;
  batch_id: string;
  dispute_id: string;
  dispute_type: string;
}): Promise<void> {
  if (!params.farmer_email || !SERVICE_ID || !TEMPLATE_FARMER) return;
  init();
  await emailjs.send(SERVICE_ID, TEMPLATE_FARMER, {
    to_email:     params.farmer_email,
    to_name:      params.farmer_name,
    dispute_ref:  shortId(params.dispute_id),
    dispute_id:   params.dispute_id,
    batch_id:     params.batch_id,
    dispute_type: params.dispute_type,
  });
}
