import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

/**
 * Regenerates and signs a new co-sign transaction.
 *
 * @param connection - Solana RPC connection.
 * @param wallet - Wallet object (must include `publicKey`).
 * @param waSignTx - Wallet signTransaction function.
 * @param lastIx - The last instruction to rebuild the transaction.
 * @returns The base64-encoded serialized transaction (unsigned for others).
 *
 * @throws Error if wallet or signing is unavailable.
 */
export async function refreshCosignTxHelper(
  connection: Connection,
  wallet: { publicKey: PublicKey } | null,
  waSignTx: ((tx: Transaction) => Promise<Transaction>) | null | undefined,
  lastIx: TransactionInstruction | null
): Promise<string> {
  if (!wallet || !lastIx)
    throw new Error("Missing wallet or transaction data.");

  const { blockhash } = await connection.getLatestBlockhash("finalized");

  const tx = new Transaction({
    feePayer: wallet.publicKey,
    recentBlockhash: blockhash,
  }).add(lastIx);

  if (!waSignTx) throw new Error("Wallet cannot sign transactions.");
  const signed = await waSignTx(tx);

  const b64 = Buffer.from(
    signed.serialize({ requireAllSignatures: false })
  ).toString("base64");

  return b64;
}
