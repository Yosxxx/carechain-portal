/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import AppSidebar from "@/components/app-sidebar";
import Navbar from "@/components/navbar";
import {
  Building2,
  FileText,
  ShieldCheck,
  Handshake,
  KeySquare,
  FileSignature,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo, useState, useEffect } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

import idl from "../../../anchor.json";
import { findPatientPda, findPatientSeqPda } from "@/lib/pda";
import { MAX_DID_LEN } from "@/constants/constants";
import { useWalletDid } from "@/hooks/useWalletDid";

// Sidebar configuration
const SIDEBAR_ITEMS = [
  {
    label: "Overview",
    href: "/user/overview",
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: "Records",
    href: "/user/records",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "Trustees",
    href: "/user/trustees",
    icon: <ShieldCheck className="w-5 h-5" />,
  },
  {
    label: "Trustee Grant",
    href: "/user/trustee-grant",
    icon: <Handshake className="w-5 h-5" />,
  },
  {
    label: "Access",
    href: "/user/access",
    icon: <KeySquare className="w-5 h-5" />,
  },
  {
    label: "Co-Sign",
    href: "/user/co-sign",
    icon: <FileSignature className="w-5 h-5" />,
  },
];

// ----------------------------------------------------------
// Registration Form (rendered if user not registered)
// ----------------------------------------------------------
function RegistrationForm({
  program,
  wallet,
  patientPda,
  seqPda,
  onRegistered,
}: {
  program: anchor.Program;
  wallet: anchor.Wallet;
  patientPda: PublicKey;
  seqPda: PublicKey;
  onRegistered: () => void;
}) {
  const { did, err: didErr } = useWalletDid();
  const [err, setErr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register new patient on-chain
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErr("");
    try {
      if (!program || !wallet || !patientPda || !seqPda)
        throw new Error("Wallet/Program not ready");

      const d = did.trim();
      if (!d) throw new Error("DID could not be derived from wallet");
      if (d.length > MAX_DID_LEN)
        throw new Error(`DID max ${MAX_DID_LEN} chars`);

      await program.methods
        .upsertPatient(d)
        .accounts({
          patientSigner: wallet.publicKey,
          patient: patientPda,
          patientSeq: seqPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onRegistered();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center gap-4 font-architekt">
      <p className="text-lg font-bold tracking-wide">
        Welcome! Please Register
      </p>
      <p className="text-sm text-gray-500">
        To use the app, you need to create a patient profile.
      </p>

      <WalletMultiButton />

      <div className="w-full max-w-sm space-y-3">
        {/* DID Display */}
        <div className="text-left">
          <label className="text-sm font-medium">DID (from Wallet)</label>
          <Input type="text" value={did} readOnly disabled />
        </div>

        {/* Registration Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !did}
          variant="outline"
        >
          {isSubmitting ? "Registering..." : "Register Profile"}
        </Button>
      </div>

      {/* Error Display */}
      {(err || didErr) && (
        <pre className="text-sm text-red-600 whitespace-pre-wrap max-w-sm text-left">
          {err || didErr}
        </pre>
      )}
    </div>
  );
}

// ----------------------------------------------------------
// Main Client Layout
// ----------------------------------------------------------
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Anchor setup
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

  // Derive PDAs
  const patientPk = wallet?.publicKey ?? null;
  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );
  const seqPda = useMemo(
    () => (patientPda ? findPatientSeqPda(programId, patientPda) : null),
    [programId, patientPda]
  );

  // Check registration status
  useEffect(() => {
    if (!wallet || !program || !patientPda) {
      setIsLoading(false);
      setIsRegistered(false);
      return;
    }

    const checkRegistration = async () => {
      setIsLoading(true);
      try {
        // If account fetch succeeds, patient is registered
        // @ts-expect-error anchor account typing
        await program.account.patient.fetch(patientPda);
        setIsRegistered(true);
      } catch {
        console.warn("Patient account not found — user not registered.");
        setIsRegistered(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkRegistration();
  }, [program, patientPda, wallet]);

  // ----------------------------------------------------------
  // Render Logic
  // ----------------------------------------------------------

  // 1. Wallet disconnected
  if (!wallet) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center gap-4 font-architekt">
        <p className="text-lg font-bold tracking-wide">Access Restricted</p>
        <p className="text-sm text-gray-500">
          Connect your Solana wallet to continue.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  // 2. Checking registration
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen font-architekt">
        <p className="text-lg">Loading user profile...</p>
      </div>
    );
  }

  // 3. Wallet connected but not registered
  if (!isRegistered) {
    return (
      <RegistrationForm
        program={program!}
        wallet={wallet as any}
        patientPda={patientPda!}
        seqPda={seqPda!}
        onRegistered={() => setIsRegistered(true)}
      />
    );
  }

  // 4. Wallet connected and registered
  return (
    <main>
      <Navbar />
      <div className="grid grid-cols-12 min-w-[1400px] max-w-[1400px] mx-auto gap-x-5">
        <div className="sticky top-[6rem] h-[calc(100vh_-_6rem)] col-span-3">
          <AppSidebar dynamicItems={SIDEBAR_ITEMS} isAdmin={false} />
        </div>

        <div className="col-span-8 mt-8">{children}</div>
        <div className="col-span-1" />
      </div>
    </main>
  );
}
