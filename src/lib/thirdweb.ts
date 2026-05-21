// =============================================================================
// thirdweb.ts
// Agri-Trust — Thirdweb v5 client initialization (browser-safe)
// Client ID is public and safe to expose in the browser bundle.
// Secret Key is NEVER used here — only in server-side / CLI tooling.
// =============================================================================

import { createThirdwebClient } from "thirdweb";

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID as string;

if (!clientId) {
  console.warn(
    "[AgriTrust] Missing VITE_THIRDWEB_CLIENT_ID in .env.local. " +
    "Blockchain features will not work."
  );
}

export const thirdwebClient = createThirdwebClient({
  clientId: clientId || "placeholder-client-id",
});
