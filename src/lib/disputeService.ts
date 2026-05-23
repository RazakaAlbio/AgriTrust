// =============================================================================
// disputeService.ts
// Agri-Trust — Supabase helpers for the dispute + dispute_responses tables
// =============================================================================

import { supabase } from "@/lib/supabase";
import {
  sendDisputeConfirmation,
  sendFarmerNotification,
} from "@/lib/emailService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisputeType =
  | "wrong_commodity"
  | "wrong_quality"
  | "wrong_weight"
  | "other";

export type DisputeStatus = "pending" | "under_review" | "resolved" | "rejected";

export const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  wrong_commodity: "Wrong Commodity",
  wrong_quality:   "Wrong Quality / Grade",
  wrong_weight:    "Wrong Weight",
  other:           "Other",
};

export interface DisputeResponse {
  id: string;
  created_at: string;
  dispute_id: string;
  author_type: "farmer" | "admin" | "customer";
  author_name: string;
  message: string;
}

export interface Dispute {
  id: string;
  created_at: string;
  batch_id: string;
  claimed_grade?: string;
  certified_txhash?: string;
  dispute_type: DisputeType;
  customer_name: string;
  customer_email: string;
  description: string;
  video_link?: string;
  status: DisputeStatus;
  resolution_note?: string;
  resolved_at?: string;
  refund_approved: boolean;
  farmer_name?: string;
  farmer_id?: string;
  responses?: DisputeResponse[];
}

export interface SubmitDisputePayload {
  batch_id: string;
  claimed_grade?: string;
  certified_txhash?: string;
  dispute_type: DisputeType;
  customer_name: string;
  customer_email: string;
  description: string;
  video_link?: string;
  farmer_name?: string;
  farmer_id?: string;
  // For email notification to farmer — not stored in DB
  farmer_email?: string;
}

// ─── Submit ──────────────────────────────────────────────────────────────────

export async function submitDispute(
  payload: SubmitDisputePayload
): Promise<{ dispute_id: string }> {
  const { farmer_email, ...dbPayload } = payload;

  const { data, error } = await supabase
    .from("disputes")
    .insert([dbPayload])
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to submit dispute");
  }

  const dispute_id = data.id as string;

  // Fire emails in background (don't throw if email fails — still prototype)
  Promise.allSettled([
    sendDisputeConfirmation({
      customer_email: payload.customer_email,
      customer_name:  payload.customer_name,
      dispute_id,
      batch_id:       payload.batch_id,
      dispute_type:   DISPUTE_TYPE_LABELS[payload.dispute_type],
    }),
    farmer_email
      ? sendFarmerNotification({
          farmer_email,
          farmer_name: payload.farmer_name ?? "Farmer",
          batch_id:    payload.batch_id,
          dispute_id,
          dispute_type: DISPUTE_TYPE_LABELS[payload.dispute_type],
        })
      : Promise.resolve(),
  ]);

  return { dispute_id };
}

// ─── Fetch (Admin) ────────────────────────────────────────────────────────────

export async function fetchDisputes(filters?: {
  status?: DisputeStatus;
  batch_id?: string;
}): Promise<Dispute[]> {
  let query = supabase
    .from("disputes")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status)   query = query.eq("status", filters.status);
  if (filters?.batch_id) query = query.ilike("batch_id", `%${filters.batch_id}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Dispute[];
}

// ─── Fetch by batch (Farmer Portal) ──────────────────────────────────────────

export async function fetchDisputesByBatch(batch_id: string): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from("disputes")
    .select("*, dispute_responses(*)")
    .eq("batch_id", batch_id.toUpperCase())
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Dispute[];
}

export async function fetchDisputeById(dispute_id: string): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from("disputes")
    .select("*, dispute_responses(*)")
    .eq("id", dispute_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // PostgREST code for "not found" single
    throw new Error(error.message);
  }
  return data as Dispute;
}

export async function fetchDisputesByFarmer(farmer_name: string): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from("disputes")
    .select("*, dispute_responses(*)")
    .ilike("farmer_name", `%${farmer_name}%`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Dispute[];
}

// ─── Fetch responses for a dispute ───────────────────────────────────────────

export async function fetchDisputeResponses(dispute_id: string): Promise<DisputeResponse[]> {
  const { data, error } = await supabase
    .from("dispute_responses")
    .select("*")
    .eq("dispute_id", dispute_id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DisputeResponse[];
}

// ─── Admin: Update dispute status ─────────────────────────────────────────────

export async function updateDisputeStatus(
  dispute_id: string,
  status: DisputeStatus,
  options?: {
    resolution_note?: string;
    refund_approved?: boolean;
    customer_email?: string;
    customer_name?: string;
    batch_id?: string;
  }
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === "resolved" || status === "rejected") {
    updates.resolved_at = new Date().toISOString();
    if (options?.resolution_note !== undefined) updates.resolution_note = options.resolution_note;
    if (options?.refund_approved !== undefined)  updates.refund_approved  = options.refund_approved;
  }

  const { error } = await supabase
    .from("disputes")
    .update(updates)
    .eq("id", dispute_id);

  if (error) throw new Error(error.message);
}

// ─── Submit response (farmer or admin) ───────────────────────────────────────

export async function submitDisputeResponse(params: {
  dispute_id: string;
  author_type: "farmer" | "admin" | "customer";
  author_name: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase
    .from("dispute_responses")
    .insert([params]);

  if (error) throw new Error(error.message);
}
