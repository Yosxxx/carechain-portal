/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import idl from "../../../../anchor.json";
import { Idl } from "@coral-xyz/anchor";

import { findPatientPda, findTrusteePda } from "@/lib/pda";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBanner } from "@/components/status-banner";
import { QRCodeCanvas } from "qrcode.react";
import { QrCode, Search } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/* ----------------------------------
   Types
----------------------------------- */

type TrusteeRow = {
  pubkey: string;
  patient: string;
  trustee: string;
  addedBy: string;
  createdAt: number;
  revoked: boolean;
};

type AnchorIdl = Idl & {
  accounts: Array<{ name: string }>;
};

export default function TrusteesPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [trustees, setTrustees] = useState<TrusteeRow[]>([]);
  const [loadingTrustees, setLoadingTrustees] = useState(false);
  const [searchTrustee, setSearchTrustee] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [trusteeStr, setTrusteeStr] = useState("");
  const [trusteeValid, setTrusteeValid] = useState<boolean | null>(null);

  const [pendingB64, setPendingB64] = useState("");
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");

  const [lastIx, setLastIx] = useState<TransactionInstruction | null>(null);

  /* ----------------------------------
     Program Setup
  ----------------------------------- */
  const programId = useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as AnchorIdl, provider) as anchor.Program;
  }, [provider]);

  const patientPk = wallet?.publicKey ?? null;

  const patientPda = useMemo(() => {
    if (!patientPk) return null;
    return findPatientPda(programId, patientPk);
  }, [programId, patientPk]);

  /* ----------------------------------
     Validate patient registration
  ----------------------------------- */
  const [patientExists, setPatientExists] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      if (!program || !patientPda) return;
      try {
        const acc = await program.account.patient.fetchNullable(patientPda);
        setPatientExists(!!acc);
      } catch {
        setPatientExists(false);
      }
    })();
  }, [program, patientPda]);

  const ensureReady = () => {
    if (!program) throw new Error("Program not ready");
    if (!wallet) throw new Error("Connect wallet first");
    if (!patientPk) throw new Error("Wallet missing");
    if (!patientExists)
      throw new Error("You are not registered as a patient yet");
  };

  /* ----------------------------------
     Validate Trustee Wallet
  ----------------------------------- */

  const checkTrusteeRegistered = useCallback(
    async (pk: PublicKey) => {
      if (!program) return;
      try {
        const tpda = findPatientPda(program.programId, pk);
        const exists = await program.account.patient.fetchNullable(tpda);
        setTrusteeValid(!!exists);
      } catch {
        setTrusteeValid(false);
      }
    },
    [program]
  );

  useEffect(() => {
    setTrusteeValid(null);
    if (!trusteeStr.trim() || !program) return;

    try {
      const pk = new PublicKey(trusteeStr.trim());
      checkTrusteeRegistered(pk);
    } catch {
      setTrusteeValid(false);
    }
  }, [trusteeStr, program, checkTrusteeRegistered]);

  /* ----------------------------------
     Load Trustees
  ----------------------------------- */

  const loadTrustees = useCallback(async () => {
    if (!program || !patientPk) return;
    setLoadingTrustees(true);

    try {
      const filters = [
        { memcmp: { offset: 8, bytes: patientPk.toBase58() } },
      ] as anchor.web3.GetProgramAccountsFilter[];

      const raw = await program.account.trustee.all(filters);

      const rows: TrusteeRow[] = raw.map((r) => ({
        pubkey: r.publicKey.toBase58(),
        patient: r.account.patient.toBase58(),
        trustee: r.account.trustee.toBase58(),
        addedBy: r.account.addedBy.toBase58(),
        createdAt: Number(r.account.createdAt),
        revoked: !!r.account.revoked,
      }));

      rows.sort((a, b) => b.createdAt - a.createdAt);
      setTrustees(rows);
    } catch {
      setTrustees([]);
    } finally {
      setLoadingTrustees(false);
    }
  }, [program, patientPk]);

  useEffect(() => {
    if (program && patientPk) loadTrustees();
  }, [program, patientPk, loadTrustees]);

  /* ----------------------------------
     Add Trustee (Prepare + QR)
  ----------------------------------- */

  const prepareAddTrustee = async () => {
    try {
      ensureReady();
      setErr("");
      setStatus("");
      setPendingB64("");

      const trusteePk = new PublicKey(trusteeStr.trim());
      if (!trusteeValid)
        throw new Error("This trustee wallet is not registered.");

      const existsAlready = trustees.some(
        (x) => x.trustee === trusteePk.toBase58() && !x.revoked
      );
      if (existsAlready) throw new Error("Already an active trustee.");

      const trusteePda = findTrusteePda(programId, patientPk!, trusteePk);

      const method = program!.methods.addTrustee().accounts({
        patient: patientPk!,
        trustee: trusteePk,
        trusteeAccount: trusteePda,
        systemProgram: SystemProgram.programId,
      });

      const ix = await method.instruction();
      setLastIx(ix);

      const { blockhash } = await connection.getLatestBlockhash("finalized");

      const tx = new Transaction({
        feePayer: patientPk!,
        recentBlockhash: blockhash,
      }).add(ix);

      const signed = await wallet!.signTransaction(tx);
      const b64 = Buffer.from(
        signed.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setPendingB64(b64);
      setStatus("Transaction Created. Share QR to co-sign.");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  };

  const refreshPayload = async () => {
    try {
      if (!lastIx) return setErr("No instruction stored.");

      const { blockhash } = await connection.getLatestBlockhash("finalized");

      const tx = new Transaction({
        feePayer: patientPk!,
        recentBlockhash: blockhash,
      }).add(lastIx);

      const signed = await wallet!.signTransaction(tx);
      const b64 = Buffer.from(
        signed.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setPendingB64(b64);
      setStatus("Transaction Refreshed.");
      toast.success("Co-sign refreshed.");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  };

  const formatTs = (ts: number) => {
    if (!ts) return "Unknown";
    return new Date(ts * 1000).toLocaleString(); // Anchor stores timestamps in seconds
  };
  /* ----------------------------------
     Revoke Trustee
  ----------------------------------- */

  const revokeTrustee = async (trusteePk: string) => {
    try {
      ensureReady();

      const trusteePda = findTrusteePda(
        programId,
        patientPk!,
        new PublicKey(trusteePk)
      );

      await program!.methods
        .revokeTrustee()
        .accounts({
          authority: wallet!.publicKey,
          patient: patientPda,
          trusteeAccount: trusteePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success("Trustee revoked");
      loadTrustees();
    } catch (e: any) {
      toast.error(e.message ?? "Error revoking trustee");
    }
  };

  /* ----------------------------------
     Search Filter
  ----------------------------------- */

  const visibleTrustees = useMemo(() => {
    const key = searchTrustee.trim().toLowerCase();
    const active = trustees.filter((t) => !t.revoked);
    if (!key) return active;
    return active.filter((t) => t.trustee.toLowerCase().includes(key));
  }, [searchTrustee, trustees]);

  /* ----------------------------------
     UI
  ----------------------------------- */
  return (
    <main className="mb-5">
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} /> Trustees
        </div>
      </header>

      {/* Search Bar */}
      <div className="my-3 flex gap-x-2">
        <Input
          placeholder="Search Trustee List"
          value={searchTrustee}
          onChange={(e) => setSearchTrustee(e.target.value)}
        />
        <Button variant="destructive" onClick={() => setSearchTrustee("")}>
          Clear
        </Button>
        <Button variant="outline" size="sm" onClick={loadTrustees}>
          Refresh
        </Button>
        <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
          <QrCode className="w-4 h-4 mr-2" /> Add Trustee
        </Button>
      </div>

      {/* Trustees List */}
      {loadingTrustees ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : visibleTrustees.length === 0 ? (
        <p className="text-sm text-muted-foreground">Trustees List Empty.</p>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {visibleTrustees.map((t) => (
            <div
              key={t.pubkey}
              className="border rounded-xs p-3 text-sm flex flex-col items-center space-y-2 text-center"
            >
              <p className="font-mono text-xs break-all">{t.trustee}</p>
              <p className="text-[10px] text-muted-foreground">
                Added: {formatTs(t.createdAt)}
              </p>
              <Separator className="w-full" />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => revokeTrustee(t.trustee)}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ADD TRUSTEE DIALOG */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add A Trustee</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-y-2">
            <Input
              placeholder="Trustee Wallet Public Key"
              value={trusteeStr}
              onChange={(e) => {
                setTrusteeStr(e.target.value);
                setPendingB64("");
                setStatus("");
                setErr("");
              }}
            />

            {/* Invalid pubkey */}
            {trusteeStr.trim() &&
              (() => {
                try {
                  new PublicKey(trusteeStr.trim());
                  return null;
                } catch {
                  return (
                    <StatusBanner type="error">
                      Invalid Wallet Address.
                    </StatusBanner>
                  );
                }
              })()}

            {trusteeValid === false && (
              <StatusBanner type="error">
                This Wallet Is Not Registered As A Patient.
              </StatusBanner>
            )}

            {trusteeValid === true &&
              trustees.some(
                (x) => x.trustee === trusteeStr.trim() && !x.revoked
              ) && (
                <StatusBanner type="error">
                  This Wallet Is Already An Active Trustee.
                </StatusBanner>
              )}

            {trusteeValid === true &&
              !trustees.some(
                (x) => x.trustee === trusteeStr.trim() && !x.revoked
              ) && (
                <StatusBanner type="success">
                  Registered Patient. Ready To Add.
                </StatusBanner>
              )}

            {err && <StatusBanner type="error">{err}</StatusBanner>}
            {pendingB64 && (
              <StatusBanner type="success">
                Transaction Ready. Share QR To Co-Sign.
              </StatusBanner>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={prepareAddTrustee}
              disabled={
                !patientExists ||
                !trusteeStr.trim() ||
                trusteeValid !== true ||
                trustees.some(
                  (x) => x.trustee === trusteeStr.trim() && !x.revoked
                )
              }
              variant="outline"
              className="w-full"
            >
              Add Trustee
            </Button>
          </DialogFooter>

          {pendingB64 && (
            <div className="flex flex-col items-center gap-4 text-center mt-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR on trustee&apos;s device:
              </p>

              <div className="p-3 border rounded bg-white dark:bg-black">
                <QRCodeCanvas
                  value={pendingB64}
                  size={256}
                  level="L"
                  includeMargin
                />
              </div>

              <div className="flex gap-x-2">
                <Button variant="outline" size="sm" onClick={refreshPayload}>
                  Refresh TX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(pendingB64);
                    toast.success("Copied payload");
                  }}
                >
                  Copy Payload
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
