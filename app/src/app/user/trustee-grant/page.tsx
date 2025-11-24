/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../../../anchor.json";

import {
  findConfigPda,
  findGrantPda,
  findHospitalPda,
  findPatientPda,
  findTrusteePda,
} from "@/lib/pda";
import { SCOPE_READ } from "@/constants/constants";
import { useQrScanner } from "@/components/useQrScanner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GeneralModal } from "@/components/general-modal";
import { StatusBanner } from "@/components/status-banner";
import { Search, QrCode } from "lucide-react";

export default function TrusteeGrantPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { QrScanner } = useQrScanner();

  // ─── Local state ─────────────────────────────────────────────────────────────
  const [patientStr, setPatientStr] = useState("");
  const [granteeStr, setGranteeStr] = useState("");
  const [trusteeOfPatient, setTrusteeOfPatient] = useState<boolean | null>(
    null
  );
  const [hospital, setHospital] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");

  // QR modal state
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"patient" | "hospital" | null>(
    null
  );

  // ─── Program setup ───────────────────────────────────────────────────────────
  const programId = useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );

  const provider = useMemo(
    () =>
      wallet
        ? new anchor.AnchorProvider(connection, wallet, {
            commitment: "confirmed",
          })
        : null,
    [connection, wallet]
  );

  const program = useMemo(
    () => (provider ? new anchor.Program(idl as anchor.Idl, provider) : null),
    [provider]
  );

  const trusteePk = wallet?.publicKey ?? null;

  // ─── Check if wallet is a valid trustee of the given patient ────────────────
  useEffect(() => {
    (async () => {
      setTrusteeOfPatient(null);
      if (!program || !patientStr.trim() || !trusteePk) return;

      try {
        const patientPk = new PublicKey(patientStr.trim());
        const trusteePda = findTrusteePda(programId, patientPk, trusteePk);
        // @ts-expect-error
        const acc = await program.account.trustee.fetchNullable(trusteePda);
        setTrusteeOfPatient(!!acc && !acc.revoked);
      } catch {
        setTrusteeOfPatient(false);
      }
    })();
  }, [program, programId, patientStr, trusteePk]);

  // ─── Verify that the grantee is a registered hospital ───────────────────────
  useEffect(() => {
    (async () => {
      setHospital(null);
      if (!program || !granteeStr.trim()) return;

      try {
        const granteePk = new PublicKey(granteeStr.trim());
        const hospitalPda = findHospitalPda(program.programId, granteePk);
        // @ts-expect-error
        const acc = await program.account.hospital.fetchNullable(hospitalPda);
        if (acc)
          setHospital({
            authority: granteePk.toBase58(),
            name: acc.name,
            createdAt: Number(acc.createdAt),
          });
      } catch {
        setHospital(null);
      }
    })();
  }, [program, granteeStr]);

  // ─── Pre-flight validation ──────────────────────────────────────────────────
  const ensureReady = () => {
    if (!program || !wallet) throw new Error("Wallet/program not ready");
    if (!trusteePk) throw new Error("Connect trustee wallet first");
    if (!patientStr.trim()) throw new Error("Enter patient wallet address");
    if (!granteeStr.trim()) throw new Error("Enter hospital authority pubkey");
  };

  // ─── Submit trustee READ grant transaction ──────────────────────────────────
  const submitGrantDirect = async () => {
    try {
      setErr("");
      setSig("");
      setStatus("");
      ensureReady();
      if (!trusteeOfPatient)
        throw new Error("You are not a valid trustee of this patient.");

      const patientPk = new PublicKey(patientStr.trim());
      const granteePk = new PublicKey(granteeStr.trim());
      const patientPda = findPatientPda(programId, patientPk);
      const grantPda = findGrantPda(
        programId,
        patientPda,
        granteePk,
        SCOPE_READ
      );
      const configPda = findConfigPda(programId);
      const trusteePda = findTrusteePda(
        programId,
        patientPk,
        wallet!.publicKey
      );

      setStatus("Submitting transaction...");

      const txSig = await program!.methods
        .grantAccess(SCOPE_READ)
        .accounts({
          authority: wallet!.publicKey,
          config: configPda,
          patient: patientPda,
          grant: grantPda,
          grantee: granteePk,
          trusteeAccount: trusteePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSig(txSig);
      setStatus("Grant successfully created and submitted.");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto mb-5">
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} /> Trustee Grant Access (READ only)
        </div>
      </header>

      {/* Patient wallet input */}
      <div className="flex items-center gap-x-2 mt-2">
        <Input
          placeholder="Patient Wallet Address"
          value={patientStr}
          onChange={(e) => setPatientStr(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => {
            setScanTarget("patient");
            setScanModalOpen(true);
          }}
        >
          <QrCode className="w-4 h-4 mr-2" /> Scan
        </Button>
      </div>

      {/* Trustee verification status */}
      <div className="mt-2">
        {trusteeOfPatient === false && (
          <StatusBanner type="error">
            ❌ You are not a registered trustee for this patient.
          </StatusBanner>
        )}
        {trusteeOfPatient === true && (
          <StatusBanner type="success">
            You are an active trustee for this patient.
          </StatusBanner>
        )}
      </div>

      {/* Hospital authority input */}
      <div className="flex items-center gap-x-2 mt-2">
        <Input
          placeholder="Hospital Authority Public Key"
          value={granteeStr}
          onChange={(e) => setGranteeStr(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => {
            setScanTarget("hospital");
            setScanModalOpen(true);
          }}
        >
          <QrCode className="w-4 h-4 mr-2" /> Scan
        </Button>
      </div>

      {/* Hospital verification banner */}
      <div className="mt-2">
        {hospital && (
          <StatusBanner type="success">
            <span className="font-medium font-mono">
              Hospital verified on-chain.
            </span>
          </StatusBanner>
        )}
        {!hospital && granteeStr.trim() && (
          <StatusBanner type="warning">
            ⚠️ No hospital found for this authority.
          </StatusBanner>
        )}
      </div>

      {/* Actions */}
      <div className="space-x-2 mt-2">
        <Button
          onClick={submitGrantDirect}
          disabled={!patientStr || !granteeStr || trusteeOfPatient !== true}
          variant="outline"
        >
          Create Grant (Trustee direct)
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setPatientStr("");
            setGranteeStr("");
            setHospital(null);
            setTrusteeOfPatient(null);
            setErr("");
            setStatus("");
            setSig("");
          }}
        >
          Clear Inputs
        </Button>
      </div>

      {/* Status + Signature */}
      <div className="mt-2">
        {status && (
          <StatusBanner type={status.startsWith("✅") ? "success" : "info"}>
            {status}
          </StatusBanner>
        )}
        {sig && (
          <div className="mt-2">
            <StatusBanner type="info">
              <span className="font-medium">Tx Signature:</span>{" "}
              <span className="font-mono">{sig}</span>
            </StatusBanner>
          </div>
        )}
        {err && <StatusBanner type="error">⚠️ {err}</StatusBanner>}
      </div>

      {/* QR Scanner modal */}
      <GeneralModal
        open={scanModalOpen}
        onOpenChange={setScanModalOpen}
        title={
          scanTarget === "patient"
            ? "Scan Patient Wallet QR"
            : "Scan Hospital Authority QR"
        }
        size="md"
        disablePadding
      >
        <QrScanner
          onResult={(text) => {
            if (scanTarget === "patient") setPatientStr(text);
            else if (scanTarget === "hospital") setGranteeStr(text);
            setScanModalOpen(false);
          }}
        />
      </GeneralModal>
    </main>
  );
}
