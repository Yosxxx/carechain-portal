/* eslint-disable @typescript-eslint/no-explicit-any */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { IPFS_GATEWAY } from "@/constants/constants";
import { findPatientSeqPda, findRecordPda } from "@/lib/pda";
import { Rec } from "@/types/Record";

/**
 * Fetch all on-chain patient records along with IPFS metadata.
 *
 * @param program - Anchor program instance
 * @param programId - Solana program ID
 * @param patientPda - Derived patient PDA
 * @returns Promise<Rec[]> Array of formatted record objects
 */
export async function fetchPatientRecords(
  program: anchor.Program,
  programId: PublicKey,
  patientPda: PublicKey
): Promise<Rec[]> {
  // 1. --- Get sequence account (to determine total records) ---
  const seqPda = findPatientSeqPda(programId, patientPda);
  // @ts-expect-error anchor typing
  const seqAcc = await program.account.patientSeq.fetch(seqPda);
  const total = Number(seqAcc.value);

  const records: Rec[] = [];

  // 2. --- Loop through all records ---
  for (let i = 0; i < total; i++) {
    const recordPda = findRecordPda(i, patientPda, programId);
    // @ts-expect-error anchor typing
    const rec = await program.account.record.fetch(recordPda);

    // 3. --- Try to fetch metadata from IPFS ---
    let meta: any = {};
    try {
      const metaRes = await fetch(IPFS_GATEWAY(rec.metaCid), {
        cache: "no-store",
      });
      meta = await metaRes.json();
    } catch {
      meta = {};
    }

    // 4. --- Normalize + format data ---
    records.push({
      seq: i,
      pda: recordPda.toBase58(),
      cidEnc: rec.cidEnc,
      metaCid: rec.metaCid,
      hospital: rec.hospital.toBase58(),
      sizeBytes: Number(rec.sizeBytes),
      createdAt: new Date(Number(rec.createdAt) * 1000).toLocaleString(),
      hospital_name: meta.hospital_name || rec.hospitalName || "",
      doctor_name: meta.doctor_name || rec.doctorName || "",
      diagnosis: meta.diagnosis || "",
      keywords: meta.keywords || "",
      medications: meta.medications || [],
      description: meta.description || "",
      txSignature: rec.txSignature ?? "",
    });
  }

  return records.reverse();
}
