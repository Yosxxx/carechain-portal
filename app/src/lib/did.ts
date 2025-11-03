// /lib/did.ts
import { PublicKey } from "@solana/web3.js";
import { MAX_DID_LEN } from "@/lib/constants";

/**
 * Pure helper to derive DID string from a Solana wallet public key.
 * Example: did:pkh:solana:devnet:4x...9H
 */
export function deriveWalletDidFromPublicKey(publicKey: PublicKey): string {
  if (!publicKey) throw new Error("Wallet not connected");

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const didStr = `did:pkh:solana:${network}:${publicKey.toBase58()}`;

  if (didStr.length > MAX_DID_LEN)
    throw new Error(`Derived DID exceeds max length (${MAX_DID_LEN})`);

  return didStr;
}
