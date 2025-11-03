/* eslint-disable @typescript-eslint/no-explicit-any */
import sodium from "libsodium-wrappers";
import { IPFS_GATEWAY } from "@/lib/constants";
import { deriveNonce } from "@/lib/helper/deriveNonce";

/**
 * Decrypts and downloads an encrypted medical record ZIP file from IPFS.
 *
 * @param rec - The record object containing metadata and CID references.
 * @param setErr - Optional callback to set error messages in UI state.
 * @returns Promise<void>
 */
export async function decryptAndDownloadHelper(
  rec: {
    pda: string;
    cidEnc: string;
    metaCid: string;
    seq: number;
    diagnosis?: string;
  },
  setErr?: (msg: string) => void
) {
  await sodium.ready;

  try {
    // 1. --- Fetch record metadata (contains wrapped DEK and info) ---
    const meta = await (
      await fetch(IPFS_GATEWAY(rec.metaCid), { cache: "no-store" })
    ).json();

    // 2. --- Unwrap DEK using backend API ---
    const unwrap = await (
      await fetch("/api/unwrap-dek", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wrapped_dek_b64: meta.wrapped_dek,
          recordId: meta.aad,
        }),
      })
    ).json();

    if (!unwrap?.dek_b64) throw new Error("Failed to unwrap DEK");
    const DEK = Uint8Array.from(Buffer.from(unwrap.dek_b64, "base64"));

    // 3. --- Fetch encrypted ZIP file from IPFS ---
    const chunkSize = meta.chunk_size ?? 1024 * 1024;
    const nonceBase = Uint8Array.from(Buffer.from(meta.nonce_base, "base64"));
    const aad = new TextEncoder().encode(meta.aad || "");
    const res = await fetch(IPFS_GATEWAY(rec.cidEnc));
    const encBuf = new Uint8Array(await res.arrayBuffer());

    // 4. --- Decrypt in chunks ---
    const TAG = sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES;
    const chunks: Uint8Array[] = [];
    let off = 0,
      idx = 0;

    while (off < encBuf.length) {
      const clen = Math.min(chunkSize + TAG, encBuf.length - off);
      const cipher = encBuf.subarray(off, off + clen);
      off += clen;

      const nonce = deriveNonce(nonceBase, idx++);
      const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        cipher,
        aad,
        nonce,
        DEK
      );
      chunks.push(plain);
    }

    // 5. --- Reassemble decrypted chunks ---
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) {
      merged.set(c, p);
      p += c.length;
    }

    // 6. --- Generate ZIP Blob and trigger download ---
    const blob = new Blob([merged], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rec.diagnosis || "medical_record"}_${rec.seq}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e: any) {
    console.error(e);
    if (setErr) setErr(e?.message ?? String(e));
    throw new Error(e?.message ?? "Decryption failed");
  }
}
