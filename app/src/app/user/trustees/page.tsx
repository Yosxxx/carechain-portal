/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import idl from "../../../../anchor.json";
import { findPatientPda, findTrusteePda } from "@/lib/pda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GeneralModal } from "@/components/general-modal";
import { QrCode, Search } from "lucide-react";
import { toast } from "sonner";
import { StatusBanner } from "@/components/status-banner";
import { QRCodeCanvas } from "qrcode.react";
import { checkAccountExists } from "@/lib/helper/checkAccountExists";
import { useQrScanner } from "@/components/useQrScanner";

export default function TrusteesPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [trusteeStr, setTrusteeStr] = useState("");
  const [trusteeValid, setTrusteeValid] = useState<boolean | null>(null);
  const [patientExists, setPatientExists] = useState<boolean | null>(null);
  const [pendingB64, setPendingB64] = useState("");
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const { QrScanner } = useQrScanner();

  // === Program and Accounts Setup ===
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

  const patientPk = wallet?.publicKey ?? null;
  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );

  const ensureReady = () => {
    if (!program || !wallet) throw new Error("Program/wallet not ready");
    if (!patientPk) throw new Error("Connect wallet first");
    if (!patientExists)
      throw new Error("You have not registered as a patient yet");
  };

  // === Trustee Check ===
  const checkTrusteeRegistered = useCallback(
    async (pk: PublicKey) => {
      if (!program) return;
      const tPda = findPatientPda(program.programId, pk);
      const exists = await checkAccountExists(program, tPda, "patient");
      setTrusteeValid(exists);
    },
    [program]
  );

  // === Patient Existence Check ===
  useEffect(() => {
    (async () => {
      if (!program || !patientPda) return;
      const exists = await checkAccountExists(program, patientPda, "patient");
      setPatientExists(exists);
    })();
  }, [program, patientPda]);

  // === Trustee Address Validation ===
  useEffect(() => {
    (async () => {
      setTrusteeValid(null);
      const t = trusteeStr.trim();
      if (!t || !program) return;
      try {
        const pk = new PublicKey(t);
        await checkTrusteeRegistered(pk);
      } catch {
        setTrusteeValid(false);
      }
    })();
  }, [trusteeStr, program, checkTrusteeRegistered]);

  // === Prepare Add Trustee Transaction ===
  const prepareAddTrustee = async () => {
    try {
      setErr("");
      setStatus("");
      setPendingB64("");
      ensureReady();

      const trusteePk = new PublicKey(trusteeStr.trim());
      if (!trusteeValid)
        throw new Error("This trustee wallet is not registered as a user.");

      const trusteePda = findTrusteePda(programId, patientPk!, trusteePk);
      setStatus("Building instruction...");

      const method = program!.methods.addTrustee().accounts({
        patient: patientPk!,
        trustee: trusteePk,
        trusteeAccount: trusteePda,
        systemProgram: SystemProgram.programId,
      });

      const ix = await method.instruction();
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const tx = new Transaction({
        feePayer: patientPk!,
        recentBlockhash: blockhash,
      }).add(ix);

      const signedByPatient = await wallet!.signTransaction(tx);
      const b64 = Buffer.from(
        signedByPatient.serialize({ requireAllSignatures: false })
      ).toString("base64");
      setPendingB64(b64);
      setStatus("✅ Transaction prepared. Share QR with trustee to co-sign.");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  };

  // === Render ===
  return (
    <main className="mb-5">
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} />
          Add a Trustee
        </div>
      </header>

      {patientExists === false && (
        <StatusBanner type="error">
          ❌ You haven&apos;t registered as a patient yet.
        </StatusBanner>
      )}

      {/* ADD TRUSTEE FORM */}
      <section className="relative mt-2">
        <div className="flex gap-x-2 items-center">
          <Input
            placeholder="Trustee Wallet Public Key"
            value={trusteeStr}
            onChange={(e) => setTrusteeStr(e.target.value)}
            onFocus={() => setTrusteeValid(null)}
          />

          <Button
            variant="destructive"
            onClick={() => {
              setTrusteeStr("");
              setTrusteeValid(null);
              setErr("");
              setStatus("");
              setPendingB64("");
            }}
          >
            Clear
          </Button>

          <Button
            variant="outline"
            onClick={() => setScanModalOpen(true)}
            title="Scan QR to fill trustee pubkey"
          >
            <QrCode className="w-4 h-4 mr-2" /> Scan QR
          </Button>

          <Button
            onClick={prepareAddTrustee}
            disabled={
              !patientExists || !trusteeStr.trim() || trusteeValid !== true
            }
            variant={"outline"}
          >
            Add Trustee
          </Button>
        </div>

        <div className="mt-2">
          {trusteeValid === true && (
            <StatusBanner type="success">
              ✅ Trustee is a registered user.
            </StatusBanner>
          )}

          {trusteeValid === false && (
            <StatusBanner type="error">
              ❌ This wallet has no Patient account yet.
            </StatusBanner>
          )}
        </div>

        {/* QR Display */}
        {pendingB64 && (
          <div className="flex flex-col items-center gap-4 text-center mt-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR on the trustee&apos;s device to co-sign:
            </p>

            <div className="p-3 border rounded bg-white dark:bg-black">
              <QRCodeCanvas
                value={pendingB64}
                size={256}
                level="L"
                includeMargin
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pendingB64);
                  toast.success("Copied QR payload to clipboard");
                } catch {
                  toast.error("Failed to copy");
                }
              }}
            >
              Copy Payload
            </Button>
          </div>
        )}
      </section>

      {/* QR SCANNER MODAL */}
      <GeneralModal
        open={scanModalOpen}
        onOpenChange={setScanModalOpen}
        title="Scan Trustee QR"
        size="md"
        disablePadding
      >
        <QrScanner
          onResult={(text) => {
            setTrusteeStr(text);
            setScanModalOpen(false);
          }}
        />
      </GeneralModal>
    </main>
  );
}
