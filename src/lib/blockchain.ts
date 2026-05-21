// =============================================================================
// blockchain.ts
// Agri-Trust — Core blockchain interaction module
//
// Responsibilities:
//  1. computeSHA256Hash()     — SHA-256 of grading payload (Web Crypto API)
//  2. getGradingContract()    — Thirdweb contract instance on Polygon Amoy
//  3. anchorGradingRecord()   — Write tx to contract + update Supabase tx_hash
//  4. verifyBatchOnChain()    — Read contract to get on-chain record
//  5. AGRITRUST_CONTRACT_ABI  — ABI for AgriTrustGrading.sol
// =============================================================================

import { getContract, prepareContractCall, readContract, sendAndConfirmTransaction } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import type { Account } from "thirdweb/wallets";
import { thirdwebClient } from "./thirdweb";
import { supabase } from "./supabase";

// ── Contract Address ──────────────────────────────────────────────────────────
// Set VITE_AGRITRUST_CONTRACT_ADDRESS in .env.local after deploying the contract.
export const CONTRACT_ADDRESS = import.meta.env.VITE_AGRITRUST_CONTRACT_ADDRESS as string || "";

// ── ABI ───────────────────────────────────────────────────────────────────────
// Minimal ABI for the functions we call from the frontend.
export const AGRITRUST_CONTRACT_ABI = [
  {
    type: "function",
    name: "anchorGradingRecord",
    inputs: [
      { name: "batchId",      type: "string",  internalType: "string"  },
      { name: "sha256Hash",   type: "bytes32", internalType: "bytes32" },
      { name: "overallGrade", type: "string",  internalType: "string"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyRecord",
    inputs: [
      { name: "batchId", type: "string", internalType: "string" },
    ],
    outputs: [
      { name: "sha256Hash",   type: "bytes32", internalType: "bytes32" },
      { name: "overallGrade", type: "string",  internalType: "string"  },
      { name: "timestamp",    type: "uint256", internalType: "uint256" },
      { name: "anchoredBy",   type: "address", internalType: "address" },
      { name: "exists",       type: "bool",    internalType: "bool"    },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyHash",
    inputs: [
      { name: "batchId",    type: "string",  internalType: "string"  },
      { name: "sha256Hash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAuthorized",
    inputs: [{ name: "device", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "GradingAnchored",
    inputs: [
      { name: "batchId",      type: "string",  indexed: true  },
      { name: "sha256Hash",   type: "bytes32", indexed: true  },
      { name: "overallGrade", type: "string",  indexed: false },
      { name: "timestamp",    type: "uint256", indexed: false },
      { name: "anchoredBy",   type: "address", indexed: true  },
    ],
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GradingPayload {
  batchId: string;
  overallGrade: string;
  weightKg: number | null;
  gasPpm: number | null;
  createdAt: string;
}

export interface AnchorResult {
  txHash: string;
  sha256Hex: string;
  explorerUrl: string;
}

export interface OnChainRecord {
  sha256Hash: string;
  overallGrade: string;
  timestamp: number;
  anchoredBy: string;
  exists: boolean;
}

// ── 1. SHA-256 Hash ───────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hash of a GradingPayload using the
 * Web Crypto API (available in all modern browsers, no extra dependency).
 *
 * Canonical format (field order is fixed):
 *   batchId|overallGrade|weightKg|gasPpm|createdAt
 *
 * @returns  hex string (64 chars) e.g. "a3f8b2..."
 */
export async function computeSHA256Hash(payload: GradingPayload): Promise<string> {
  const canonical = [
    payload.batchId,
    payload.overallGrade,
    String(payload.weightKg ?? "null"),
    String(payload.gasPpm ?? "null"),
    payload.createdAt,
  ].join("|");

  const msgBuffer = new TextEncoder().encode(canonical);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert a hex SHA-256 string (64 chars) to a bytes32 value for Solidity.
 * Returns a `0x`-prefixed hex string padded to 66 chars.
 */
export function hexToBytes32(hex: string): `0x${string}` {
  // Remove 0x prefix if present, pad to 64 chars, add 0x back
  const clean = hex.replace(/^0x/, "").padStart(64, "0");
  return `0x${clean}` as `0x${string}`;
}

// ── 2. Contract Instance ──────────────────────────────────────────────────────

/**
 * Returns a Thirdweb contract instance for AgriTrustGrading on Polygon Amoy.
 * Throws if the contract address has not been configured.
 */
export function getGradingContract() {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "[AgriTrust] VITE_AGRITRUST_CONTRACT_ADDRESS is not set in .env.local. " +
      "Deploy the contract first and add the address to your environment."
    );
  }
  return getContract({
    client: thirdwebClient,
    chain:  polygonAmoy,
    address: CONTRACT_ADDRESS,
    abi:    AGRITRUST_CONTRACT_ABI,
  });
}

// ── 3. Anchor Grading Record ──────────────────────────────────────────────────

/**
 * Anchor a grading record on-chain and write the resulting tx hash back to
 * the Supabase `scans` table.
 *
 * @param account      Thirdweb Account (from useActiveAccount())
 * @param supabaseScanId  The UUID of the scan row in Supabase
 * @param payload      The grading data to hash and anchor
 * @returns AnchorResult with txHash, sha256Hex, and explorerUrl
 */
export async function anchorGradingRecord(
  account:        Account,
  supabaseScanId: string,
  payload:        GradingPayload
): Promise<AnchorResult> {
  // 1. Compute SHA-256
  const sha256Hex = await computeSHA256Hash(payload);
  const sha256Bytes32 = hexToBytes32(sha256Hex);

  // 2. Get contract instance
  const contract = getGradingContract();

  // 3. Prepare the transaction
  const transaction = prepareContractCall({
    contract,
    method:  "anchorGradingRecord",
    params:  [payload.batchId, sha256Bytes32, payload.overallGrade],
  });

  // 4. Send and wait for confirmation
  const receipt = await sendAndConfirmTransaction({ account, transaction });
  const txHash = receipt.transactionHash;
  const explorerUrl = `https://amoy.polygonscan.com/tx/${txHash}`;

  // 5. Write tx_hash back to Supabase
  const { error } = await supabase
    .from("scans")
    .update({ tx_hash: txHash })
    .eq("id", supabaseScanId);

  if (error) {
    console.error("[AgriTrust] Failed to update tx_hash in Supabase:", error);
    // Don't throw — the chain anchor succeeded even if Supabase update fails
  }

  return { txHash, sha256Hex, explorerUrl };
}

// ── 4. Read On-Chain Record ───────────────────────────────────────────────────

/**
 * Read a grading record from the contract by batchId.
 * @returns OnChainRecord — check .exists before using other fields
 */
export async function verifyBatchOnChain(batchId: string): Promise<OnChainRecord> {
  const contract = getGradingContract();
  const result = await readContract({
    contract,
    method: "verifyRecord",
    params: [batchId],
  });

  return {
    sha256Hash:   result[0] as string,
    overallGrade: result[1] as string,
    timestamp:    Number(result[2]),
    anchoredBy:   result[3] as string,
    exists:       result[4] as boolean,
  };
}

// ── 5. Explorer URL helper ────────────────────────────────────────────────────

export const AMOY_EXPLORER = "https://amoy.polygonscan.com";

export function buildBlockchainTxUrl(txHash?: string | null): string {
  if (!txHash) return AMOY_EXPLORER;
  return `${AMOY_EXPLORER}/tx/${txHash}`;
}
