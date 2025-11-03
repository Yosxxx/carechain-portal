"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  ChevronsUpDown,
  ExternalLink,
  QrCodeIcon,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { StatusBanner } from "@/components/status-banner";
import { FilterButton } from "@/components/filter-button";

import { useProgram } from "@/hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQrScanner } from "@/components/useQrScanner";

import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";

import { findGrantPda, findPatientPda } from "@/lib/pda";
import { SCOPE_READ } from "@/constants/constants";
import { Rec } from "@/types/Record";

import { fetchPatientRecords } from "@/lib/helper/fetchPatientRecords";
import { decryptAndDownloadHelper } from "@/lib/helper/decryptAndDownload";
import { deriveAttachmentStatus } from "@/lib/helper/attachments";
import { filterRecords, paginate } from "@/lib/helper/recordFilters";

export default function Page() {
  // ────────────────────────────────────────────────
  // ░ State & Hooks
  // ────────────────────────────────────────────────
  const { QrScanner } = useQrScanner();
  const { publicKey: hospitalWallet } = useWallet();
  const { program, programId, ready } = useProgram();

  const [patientInput, setPatientInput] = useState("");
  const [records, setRecords] = useState<Rec[]>([]);
  const [downloadAllowed, setDownloadAllowed] = useState<
    Record<string, boolean>
  >({});

  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGrant, setHasGrant] = useState<boolean | null>(null);

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [scanning, setScanning] = useState(false);

  const perPage = 5;
  const disabled = !ready || !program || !hospitalWallet;

  // ────────────────────────────────────────────────
  // ░ Derived Lists (Filtered + Paginated)
  // ────────────────────────────────────────────────
  const filteredRecords = useMemo(
    () => filterRecords(records, search, filterMode),
    [records, search, filterMode]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / perPage));

  const paginated = useMemo(
    () => paginate(filteredRecords, page, perPage),
    [filteredRecords, page, perPage]
  );

  // ────────────────────────────────────────────────
  // ░ Attachment Status
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!records?.length) {
      setDownloadAllowed({});
      return;
    }
    setDownloadAllowed(deriveAttachmentStatus(records));
  }, [records]);

  // ────────────────────────────────────────────────
  // ░ Fetch Patient Records
  // ────────────────────────────────────────────────
  async function handleFetchPatientRecords() {
    try {
      setRecords([]);
      setErr("");
      setStatus("⏳ Loading...");
      setLoading(true);
      setHasGrant(null);
      setDownloadAllowed({});

      const patientWalletPk = new PublicKey(patientInput.trim());
      const patientPda = findPatientPda(programId, patientWalletPk);

      // Check patient registration
      // @ts-expect-error anchor typing
      const pAcc = await program!.account.patient.fetchNullable(patientPda);
      if (!pAcc) throw new Error("Patient not registered.");

      // Validate read grant
      const grantReadPda = findGrantPda(
        programId,
        patientPda,
        hospitalWallet!,
        SCOPE_READ
      );
      // @ts-expect-error anchor typing
      const grantAcc = await program!.account.grant.fetchNullable(grantReadPda);
      if (
        !grantAcc ||
        grantAcc.revoked ||
        (Number(grantAcc.expiresAt) &&
          Number(grantAcc.expiresAt) <= Math.floor(Date.now() / 1000))
      ) {
        setHasGrant(false);
        throw new Error("No active read grant for this patient.");
      }

      setHasGrant(true);

      // Fetch all records
      const records = await fetchPatientRecords(
        program!,
        programId,
        patientPda
      );
      setRecords(records);

      setStatus("✅ Records fetched successfully.");
      toast.success("Records fetched successfully.");
    } catch (e: any) {
      const message = e.message || String(e);
      setErr(message);
      setStatus("");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────
  // ░ Decrypt + Download
  // ────────────────────────────────────────────────
  async function handleDecryptAndDownload(rec: Rec) {
    if (downloadAllowed[rec.pda] === false) {
      toast.info("This record only contains metadata and no file attachments.");
      return;
    }

    try {
      setStatus("Decrypting...");
      await decryptAndDownloadHelper(rec, setErr);
      setStatus("✅ Download complete.");
      toast.success("Decrypted file downloaded.");
    } catch (e: any) {
      const msg = e?.message ?? "Decryption failed";
      setErr(msg);
      setStatus("");
      toast.error(msg);
    }
  }

  // ────────────────────────────────────────────────
  // ░ Render
  // ────────────────────────────────────────────────
  return (
    <main className="mt-5 mx-auto">
      {/* ── Header ────────────────────────────── */}
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} /> Search for Patients
        </div>
      </header>

      {/* ── Status Banners ────────────────────── */}
      <div className="space-y-2 my-2">
        {err && <StatusBanner type="error">❌ {err}</StatusBanner>}
        {status && !err && status.toLowerCase().includes("loading") && (
          <StatusBanner type="info">⏳ {status}</StatusBanner>
        )}
        {status && !err && status.startsWith("✅") && (
          <StatusBanner type="success">{status}</StatusBanner>
        )}
        {status && !err && status.startsWith("ℹ️") && (
          <StatusBanner type="info">{status}</StatusBanner>
        )}
        {hasGrant === false && (
          <StatusBanner type="warning">
            ⚠️ No active read grant. Ask patient to authorize this hospital.
          </StatusBanner>
        )}
      </div>

      {/* ── Controls ──────────────────────────── */}
      <div className="mt-2 flex gap-x-3 mb-5">
        <Input
          placeholder="Search records..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Button
          onClick={handleFetchPatientRecords}
          disabled={disabled || loading || !patientInput.trim()}
          variant="outline"
        >
          {loading ? "Loading..." : "Search"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setPatientInput("");
            setRecords([]);
            setErr("");
            setStatus("");
            setHasGrant(null);
            setDownloadAllowed({});
            toast.info("Search cleared.");
          }}
        >
          Clear
        </Button>
        <FilterButton
          options={[
            { label: "Default", value: null },
            { label: "Doctor (A-Z)", value: "doctor" },
            { label: "Hospital (A-Z)", value: "hospital" },
            { label: "Date ↑", value: "dateAsc" },
            { label: "Date ↓", value: "dateDesc" },
          ]}
          selected={filterMode}
          onChange={(v) => {
            setFilterMode(v);
            setPage(1);
          }}
        />
        <Button variant="outline" onClick={() => setScanning(true)}>
          <QrCodeIcon />
        </Button>
      </div>

      {/* ── Record List ───────────────────────── */}
      {hasGrant && records.length > 0 && (
        <div className="flex flex-col gap-y-4 mb-5">
          {paginated.map((rec) => (
            <Collapsible key={rec.pda} className="border p-4 rounded-xs">
              <CollapsibleTrigger className="flex justify-between items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-sm">
                    {rec.diagnosis || "Untitled Diagnosis"}
                  </div>
                  {rec.keywords && (
                    <div className="text-sm text-muted-foreground space-x-2">
                      <span>{rec.keywords}</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(rec.createdAt).toLocaleDateString()}
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium">Hospital Name</div>
                    <div className="font-mono border p-2 rounded-xs">
                      {rec.hospital_name || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium">Doctor Name</div>
                    <div className="font-mono border p-2 rounded-xs">
                      {rec.doctor_name || "N/A"}
                    </div>
                  </div>
                </div>

                {rec.description && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <div className="text-xs font-medium">Description</div>
                      <p className="whitespace-pre-wrap border p-2 rounded-xs min-h-52 max-h-52">
                        {rec.description}
                      </p>
                    </div>
                  </>
                )}

                {rec.txSignature && (
                  <div>
                    <div className="text-xs font-medium">
                      Transaction Signature
                    </div>
                    <a
                      href={`https://solscan.io/tx/${rec.txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      View on Solscan <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}

                <Separator className="my-2" />
                <div className="pt-3 border-t mt-3">
                  <Button
                    onClick={() => handleDecryptAndDownload(rec)}
                    variant="secondary"
                    disabled={downloadAllowed[rec.pda] === false}
                  >
                    {downloadAllowed[rec.pda] === false
                      ? "No Attachments"
                      : "Download & Decrypt"}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────── */}
      {filteredRecords.length > perPage && (
        <Pagination className="mb-5">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={page === i + 1}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(i + 1);
                  }}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* ── QR Scanner ───────────────────────── */}
      {scanning && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
          <div className="bg-background border border-border rounded-xl shadow-xl">
            <QrScanner
              label="Scan Patient QR"
              onResult={(value) => {
                setPatientInput(value);
                setScanning(false);
                toast.success("QR decoded successfully.");
              }}
            />
          </div>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => setScanning(false)}
          >
            <X className="w-4 h-4 mr-2" /> Close Scanner
          </Button>
        </div>
      )}
    </main>
  );
}
