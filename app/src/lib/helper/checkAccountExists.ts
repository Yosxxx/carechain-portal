import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * Checks if a given account PDA exists on-chain.
 *
 * @param program - Anchor program instance
 * @param pda - PublicKey of the PDA to verify
 * @param accountName - (Optional) Account type name defined in IDL (e.g. "patient")
 * @returns Promise<boolean> - true if exists, false otherwise
 */
export async function checkAccountExists(
  program: anchor.Program,
  pda: PublicKey,
  accountName = "patient"
): Promise<boolean> {
  try {
    // @ts-expect-error: dynamic access to account type
    const acc = await program.account[accountName].fetchNullable(pda);
    return !!acc;
  } catch {
    return false;
  }
}
