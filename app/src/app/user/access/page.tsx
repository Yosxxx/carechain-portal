/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  Search,
  BookCheck,
  ClipboardCopyIcon,
  ChevronsUpDown,
} from "lucide-react";

import idl from "../../../../anchor.json";
import {
  findGrantPda,
  findHospitalPda,
  findPatientPda,
  findConfigPda,
  findTrusteePda,
} from "@/lib/pda";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBanner } from "@/components/status-banner";
import HospitalList from "@/components/hospital-list";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type HospitalUi = {
  pubkey: string;
  authority: string;
  name: string;
  kmsRef: string;
  createdAt: number;
} | null;

type GrantUi = {
  pubkey: string;
  scope: number;
  patient: string;
  grantee: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number | null;
  revoked: boolean;
  revokedAt?: number | null;
};

// ─────────────────────────────────────────────────────────────
// PAGE START
// ─────────────────────────────────────────────────────────────
export default function Page() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // helper: does account exist?
  async function accountExists(pubkey: PublicKey): Promise<boolean> {
    const info = await connection.getAccountInfo(pubkey);
    return !!info;
  }

  // ─── UI State ──────────────────────────────────────────────
  const [filterGranteeStr, setFilterGranteeStr] = useState("");
  const [activeGranteeStr, setActiveGranteeStr] = useState("");

  const [hospital, setHospital] = useState<HospitalUi>(null);
  const [patientExists, setPatientExists] = useState<boolean | null>(null);
  const [grants, setGrants] = useState<GrantUi[]>([]);
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");

  const [selectedHospital, setSelectedHospital] = useState<null | {
    authority_pubkey: string;
    name: string;
    address: string;
  }>(null);

  // ─── Anchor Program Setup ──────────────────────────────────
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

  // ─── PDAs ───────────────────────────────────────────────────
  const patientPk = wallet?.publicKey ?? null;
  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );

  const grantee = useMemo(() => {
    try {
      const t = activeGranteeStr.trim();
      return t ? new PublicKey(t) : null;
    } catch {
      return null;
    }
  }, [activeGranteeStr]);

  // ─── Check if patient exists ────────────────────────────────
  useEffect(() => {
    (async () => {
      setPatientExists(null);
      if (!program || !patientPda) return;

      try {
        // @ts-expect-error
        const acc = await program.account.patient.fetchNullable(patientPda);
        setPatientExists(!!acc);
      } catch {
        setPatientExists(false);
      }
    })();
  }, [program, patientPda]);

  // ─── Load hospital preview ──────────────────────────────────
  useEffect(() => {
    (async () => {
      setHospital(null);
      if (!program || !grantee) return;

      try {
        const hospitalPda = findHospitalPda(program.programId, grantee);
        // @ts-expect-error
        const acc = await program.account.hospital.fetchNullable(hospitalPda);
        if (!acc) return setHospital(null);

        setHospital({
          pubkey: hospitalPda.toBase58(),
          authority: grantee.toBase58(),
          name: acc.name as string,
          kmsRef: acc.kmsRef as string,
          createdAt: Number(acc.createdAt),
        });
      } catch {
        setHospital(null);
      }
    })();
  }, [program, grantee]);

  // ─── Load all grants ────────────────────────────────────────
  const loadGrants = async () => {
    try {
      if (!program || !patientPda) return setGrants([]);

      const filters: anchor.web3.GetProgramAccountsFilter[] = [
        { memcmp: { offset: 8, bytes: patientPda.toBase58() } },
      ];

      if (grantee) {
        filters.push({ memcmp: { offset: 8 + 32, bytes: grantee.toBase58() } });
      }

      // @ts-expect-error
      const raw = await program.account.grant.all(filters);
      const rows: GrantUi[] = raw.map((r: any) => ({
        pubkey: r.publicKey.toBase58(),
        scope: r.account.scope,
        patient: r.account.patient.toBase58(),
        grantee: r.account.grantee.toBase58(),
        createdBy: r.account.createdBy.toBase58?.() ?? r.account.createdBy,
        createdAt: Number(r.account.createdAt),
        expiresAt: r.account.expiresAt ? Number(r.account.expiresAt) : null,
        revoked: !!r.account.revoked,
        revokedAt: r.account.revokedAt ? Number(r.account.revokedAt) : null,
      }));

      rows.sort((a, b) => b.createdAt - a.createdAt);
      setGrants(rows);
    } catch (e: any) {
      console.error(e);
      setGrants([]);
    }
  };

  useEffect(() => {
    void loadGrants();
  }, [program, patientPda?.toBase58(), grantee?.toBase58()]);

  // ─── Button Logic Setup ─────────────────────────────────────
  const current: Record<number, boolean> = useMemo(() => {
    const m: Record<number, boolean> = {};
    for (const g of grants) if (!g.revoked) m[g.scope] = true;
    return m;
  }, [grants]);

  const currentGrants = useMemo(() => {
    return grants.filter((g) => g.grantee === grantee?.toBase58());
  }, [grants, grantee]);

  const canAct = !!program && !!patientPk && patientExists !== false;

  const ensureReady = () => {
    if (!program || !wallet) throw new Error("Program/wallet not ready");
    if (!patientPk) throw new Error("Connect wallet first");
    if (!patientExists)
      throw new Error("You have not registered as a patient yet");
    if (!grantee) throw new Error("Invalid grantee pubkey");
  };

  const assertHospitalRegistered = async () => {
    if (!grantee) throw new Error("Invalid grantee");
    const hospitalPda = findHospitalPda(programId, grantee);
    // @ts-expect-error
    const acc = await program!.account.hospital.fetchNullable(hospitalPda);
    if (!acc) throw new Error("Hospital not registered");
  };

  const upsertOne = async (scopeByte: number) => {
    setErr("");
    setSig("");
    ensureReady();
    await assertHospitalRegistered();

    const grantPda = findGrantPda(programId, patientPda!, grantee!, scopeByte);
    const configPda = findConfigPda(programId);
    const trusteePda = findTrusteePda(programId, patientPk!, wallet!.publicKey);
    const trusteeExists = await accountExists(trusteePda);

    const tx = await program!.methods
      .grantAccess(scopeByte)
      .accounts({
        authority: wallet!.publicKey,
        config: configPda,
        patient: patientPda!,
        grant: grantPda,
        grantee: grantee!,
        ...(trusteeExists
          ? { trusteeAccount: trusteePda }
          : { trusteeAccount: null as any }),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    setSig(tx);
  };

  const revokeOne = async (scopeByte: number) => {
    setErr("");
    setSig("");
    ensureReady();

    const grantPda = findGrantPda(programId, patientPda!, grantee!, scopeByte);

    const tx = await program!.methods
      .revokeGrant()
      .accounts({
        patient: patientPda!,
        grant: grantPda,
        grantee: grantee!,
        authority: wallet!.publicKey,
      })
      .rpc();

    setSig(tx);
  };

  // ─────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto mb-5">
      {/* Header */}
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} /> Search for Hospitals
        </div>
      </header>

      {/* Patient Missing */}
      {patientExists === false && (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>Patient Record Not Found</AlertTitle>
          <AlertDescription>
            You haven&apos;t registered as a patient yet.
          </AlertDescription>
        </Alert>
      )}

      {/* HOSPITAL LIST (Hidden when one is selected) */}
      {!selectedHospital && (
        <HospitalList
          onSelect={(h) => {
            setSelectedHospital(h);
            setFilterGranteeStr(h.authority_pubkey);
            setActiveGranteeStr(h.authority_pubkey);
          }}
        />
      )}

      {/* ACCESS CONSOLE (Only when a hospital is selected) */}
      {selectedHospital && hospital && (
        <div className="mt-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedHospital(null);
              setHospital(null);
              setFilterGranteeStr("");
              setActiveGranteeStr("");
              setGrants([]);
            }}
          >
            ← Back to Hospital List
          </Button>

          <section className="border rounded-xs p-6 space-y-6 bg-card mt-5">
            <div className="border rounded-xs p-5 bg-card mt-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xs bg-secondary">
                  <BookCheck className="w-5 h-5 text-secondary-foreground" />
                </div>

                <div className="flex-1 space-y-2">
                  <h2 className="text-sm font-semibold">Hospital Verified</h2>
                  <p className="text-xs text-muted-foreground">
                    Authority confirmed and active
                  </p>

                  <div className="grid gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground/70">Name</span>
                      <span className="font-medium">
                        {selectedHospital.name}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground/70">
                        Authority
                      </span>
                      <span className="font-mono break-all text-right text-muted-foreground">
                        {hospital.authority}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground/70">
                        Hospital PDA
                      </span>
                      <span className="font-mono break-all text-right text-muted-foreground">
                        {hospital.pubkey}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MANAGE ACCESS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Manage Access</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Grant Write */}
                <Button
                  onClick={async () => {
                    try {
                      if (current[1] && !current[2]) {
                        await revokeOne(1);
                        await upsertOne(2);
                      } else if (!current[1] && !current[2]) {
                        await upsertOne(2);
                      }
                      await loadGrants();
                    } catch (e: any) {
                      setErr(e.message);
                    }
                  }}
                  disabled={
                    !canAct ||
                    !grantee ||
                    (current[1] && current[2]) ||
                    (current[2] && !current[1])
                  }
                  variant={
                    (current[1] && !current[2]) || (!current[1] && !current[2])
                      ? "default"
                      : "outline"
                  }
                >
                  {current[1] && !current[2]
                    ? "Revoke Read → Grant Write"
                    : current[2] && !current[1]
                    ? "Write Granted"
                    : current[1] && current[2]
                    ? "All Active"
                    : "Grant Write"}
                </Button>

                {/* Grant Read */}
                <Button
                  onClick={async () => {
                    try {
                      if (current[2] && !current[1]) {
                        await revokeOne(2);
                        await upsertOne(1);
                      } else if (!current[1] && !current[2]) {
                        await upsertOne(1);
                      }
                      await loadGrants();
                    } catch (e: any) {
                      setErr(e.message);
                    }
                  }}
                  disabled={
                    !canAct ||
                    !grantee ||
                    (current[1] && current[2]) ||
                    (current[1] && !current[2])
                  }
                  variant={
                    (current[2] && !current[1]) || (!current[1] && !current[2])
                      ? "default"
                      : "outline"
                  }
                >
                  {current[2] && !current[1]
                    ? "Revoke Write → Grant Read"
                    : current[1] && !current[2]
                    ? "Read Granted"
                    : current[1] && current[2]
                    ? "All Active"
                    : "Grant Read"}
                </Button>

                {/* Revoke All */}
                <Button
                  onClick={async () => {
                    try {
                      if (current[1]) await revokeOne(1);
                      if (current[2]) await revokeOne(2);
                      await loadGrants();
                    } catch (e: any) {
                      setErr(e.message);
                    }
                  }}
                  disabled={!canAct || !grantee || (!current[1] && !current[2])}
                  variant="destructive"
                >
                  Revoke All
                </Button>

                {/* Grant All */}
                <Button
                  onClick={async () => {
                    try {
                      if (!current[1] && !current[2]) {
                        await upsertOne(1);
                        await upsertOne(2);
                      } else if (current[1] && !current[2]) {
                        await upsertOne(2);
                      } else if (!current[1] && current[2]) {
                        await upsertOne(1);
                      }
                      await loadGrants();
                    } catch (e: any) {
                      setErr(e.message);
                    }
                  }}
                  disabled={!canAct || !grantee || (current[1] && current[2])}
                >
                  {current[1] && current[2]
                    ? "All Granted"
                    : !current[1] && !current[2]
                    ? "Grant All"
                    : "Grant Remaining"}
                </Button>
              </div>
            </div>

            {/* TX STATUS */}
            {sig && (
              <StatusBanner type="success">
                Transaction Confirmed: {sig}
              </StatusBanner>
            )}

            {err && <StatusBanner type="error">❌ {err}</StatusBanner>}
          </section>

          {/* CURRENT GRANTEE GRANTS - COLLAPSIBLE */}
          <div className="flex flex-col gap-y-3 mt-6">
            {currentGrants.map((g) => (
              <Collapsible key={g.pubkey} className="border p-4 rounded-xs">
                {/* Collapsible Header */}
                <CollapsibleTrigger className="w-full flex justify-between items-center text-left gap-4 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-sm">
                      {selectedHospital?.name ?? g.grantee}
                    </div>

                    <div className="text-sm text-muted-foreground space-x-2">
                      <span>{g.scope === 1 ? "Read" : "Write"}</span>
                      <span>&bull;</span>
                      <span
                        className={
                          g.revoked ? "text-red-600" : "text-green-600"
                        }
                      >
                        {g.revoked ? "Revoked" : "Active"}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(g.createdAt * 1000).toLocaleDateString()}
                  </div>

                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>

                {/* Collapsible Content */}
                <CollapsibleContent className="mt-4 pt-4 border-t space-y-3 text-xs">
                  {/* Grantee Pubkey */}
                  <div>
                    <div className="font-semibold uppercase text-[10px]">
                      Hospital Pubkey (Grantee)
                    </div>

                    <div className="flex gap-x-2">
                      <div className="font-mono border bg-muted p-2 rounded-xs break-all flex-1">
                        {g.grantee}
                      </div>
                    </div>
                  </div>

                  {/* Grant PDA */}
                  <div>
                    <div className="font-semibold uppercase text-[10px]">
                      Grant PDA (TX)
                    </div>
                    <div className="font-mono border bg-muted p-2 rounded-xs break-all">
                      {g.pubkey}
                    </div>
                  </div>

                  {/* Created By */}
                  <div>
                    <div className="font-semibold uppercase text-[10px]">
                      Created By
                    </div>
                    <div className="font-mono border bg-muted p-2 rounded-xs break-all">
                      {g.createdBy}
                    </div>
                  </div>

                  {/* Revoke Button */}
                  {!g.revoked && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        try {
                          await revokeOne(g.scope);
                          await loadGrants();
                        } catch (e: any) {
                          setErr(e.message);
                        }
                      }}
                    >
                      Revoke this grant
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
