"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  ChevronsUpDown,
  ExternalLink,
  QrCodeIcon,
  Loader2,
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

import AiRecordSummarizer from "@/components/AiRecordSummarizer";
import { GeneralModal } from "@/components/general-modal";

export default function Page() {
  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────
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
  const disabledBase = !ready || !program || !hospitalWallet;
  const requestIdRef = useRef(0);

  // ─────────────────────────────────────────────
  // AI Summary
  // ─────────────────────────────────────────────
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [cachedSummary, setCachedSummary] = useState<string | null>(null);

  async function handleAISummary(forceRefresh = false) {
    try {
      setSummaryOpen(true);

      if (!forceRefresh && cachedSummary) {
        setSummaryText(cachedSummary);
        return;
      }

      setSummaryLoading(true);
      setSummaryText("");

      const payload = records.map((r) => ({
        created_at: r.createdAt,
        doctor: r.doctor_name,
        hospital: r.hospital_name,
        diagnosis: r.diagnosis,
        meds: r.medications,
        description: r.description,
      }));

      const res = await fetch("/api/ai-summary", {
        method: "POST",
        body: JSON.stringify({ records: payload }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      const summary = data.summary || "AI failed to summarize.";

      setSummaryText(summary);
      setCachedSummary(summary);
    } catch (err: any) {
      setSummaryText(err?.message || "Error generating summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  // ─────────────────────────────────────────────
  // FILTERING & PAGINATION
  // ─────────────────────────────────────────────
  const filteredRecords = useMemo(
    () => filterRecords(records, search, filterMode),
    [records, search, filterMode]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / perPage));

  const paginated = useMemo(
    () => paginate(filteredRecords, page, perPage),
    [filteredRecords, page, perPage]
  );

  // ─────────────────────────────────────────────
  // ATTACHMENT STATUS
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!records.length) return setDownloadAllowed({});
    setDownloadAllowed(deriveAttachmentStatus(records));
  }, [records]);

  // ─────────────────────────────────────────────
  // FETCH PATIENT RECORDS
  // ─────────────────────────────────────────────
  async function handleFetchPatientRecords() {
    const currentRequestId = ++requestIdRef.current;

    try {
      setRecords([]);
      setErr("");
      setStatus("");
      setLoading(true);
      setHasGrant(null);
      setCachedSummary(null);

      const patientWalletPk = new PublicKey(patientInput.trim());
      const patientPda = findPatientPda(programId, patientWalletPk);

      // Validate patient
      // @ts-expect-error anchor typing
      const pAcc = await program!.account.patient.fetchNullable(patientPda);
      if (!pAcc) throw new Error("Patient not registered.");

      // Validate Read Grant
      const grantReadPda = findGrantPda(
        programId,
        patientPda,
        hospitalWallet!,
        SCOPE_READ
      );

      // @ts-expect-error anchor typing
      const grantAcc = await program!.account.grant.fetchNullable(grantReadPda);
      const now = Math.floor(Date.now() / 1000);

      const expired =
        Number(grantAcc?.expiresAt ?? 0) !== 0 &&
        Number(grantAcc?.expiresAt ?? 0) <= now;

      if (!grantAcc || grantAcc.revoked || expired) {
        if (currentRequestId === requestIdRef.current) setHasGrant(false);
        throw new Error("No active read grant for this patient.");
      }

      if (currentRequestId === requestIdRef.current) setHasGrant(true);

      // Fetch Records
      const recs = await fetchPatientRecords(program!, programId, patientPda);
      if (currentRequestId === requestIdRef.current) setRecords(recs);

      if (currentRequestId === requestIdRef.current)
        setStatus("Records fetched successfully.");
    } catch (e: any) {
      if (currentRequestId !== requestIdRef.current) return;
      setErr(e?.message ?? String(e));
      setStatus("");
    } finally {
      if (currentRequestId === requestIdRef.current) setLoading(false);
    }
  }

  // ─────────────────────────────────────────────
  // CLEAR (Option C)
  // ─────────────────────────────────────────────
  function handleClear() {
    requestIdRef.current += 1;
    setPatientInput("");
    setRecords([]);
    setErr("");
    setStatus("");
    setHasGrant(null);
    setDownloadAllowed({});
    setSearch("");
    setFilterMode(null);
    setPage(1);
    setLoading(false);
    setCachedSummary(null);
    toast.info("Search cleared.");
  }

  // ─────────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────────
  async function handleDecryptAndDownload(rec: Rec) {
    if (downloadAllowed[rec.pda] === false) {
      toast.info("This record has no file attachments.");
      return;
    }

    try {
      setStatus("Decrypting...");
      await decryptAndDownloadHelper(rec, setErr);
      toast.success("Decrypted file downloaded.");
      setStatus("Download complete.");
    } catch (e: any) {
      toast.error(e?.message ?? "Decryption failed");
      setStatus("");
    }
  }

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return (
    <main>
      {/* HEADER */}
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} /> Search for Patients
        </div>
      </header>

      {/* CONTROLS */}
      <div className="mt-2 flex gap-x-3 mb-3">
        <Input
          placeholder="Input Patient Public Key"
          value={patientInput}
          onChange={(e) => setPatientInput(e.target.value)}
          disabled={disabledBase || loading}
        />

        <Button
          onClick={handleFetchPatientRecords}
          disabled={disabledBase || loading || !patientInput.trim()}
          variant="outline"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>

        <Button
          variant="outline"
          onClick={() => handleAISummary()}
          disabled={loading || records.length === 0}
        >
          AI Summary
        </Button>

        <Button
          variant="destructive"
          disabled={!patientInput && records.length === 0 && !status && !err}
          onClick={handleClear}
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
          disabled={loading || records.length === 0}
        />

        <Button
          variant="outline"
          onClick={() => setScanning(true)}
          disabled={disabledBase || loading}
        >
          <QrCodeIcon className="w-4 h-4" />
        </Button>
      </div>

      {/* INTERNAL SEARCH */}
      {records.length > 0 && (
        <Input
          placeholder="Filter within records..."
          className="mb-3"
          disabled={loading}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      )}

      {/* STATUS BANNERS */}
      <div className="space-y-2 my-2">
        {err && <StatusBanner type="error">❌ {err}</StatusBanner>}
        {loading && (
          <StatusBanner type="info">
            <Loader2 className="w-4 h-4 animate-spin" /> Fetching...
          </StatusBanner>
        )}
        {hasGrant === false && !loading && (
          <StatusBanner type="warning">
            No active read grant for this patient.
          </StatusBanner>
        )}
        {status && !loading && !err && (
          <StatusBanner type="success">{status}</StatusBanner>
        )}
      </div>

      {/* RECORD LIST */}
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
                      {rec.keywords}
                    </div>
                  )}
                </div>

                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(rec.createdAt).toLocaleDateString()}
                </div>

                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4 text-sm">
                {/* HOSPITAL + DOCTOR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium">Hospital Name</div>
                    <div className="font-mono border p-2 rounded-xs">
                      {rec.hospital_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium">Doctor Name</div>
                    <div className="font-mono border p-2 rounded-xs">
                      {rec.doctor_name}
                    </div>
                  </div>
                </div>

                {/* DESCRIPTION */}
                {rec.description && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium">Description</div>
                      <p className="whitespace-pre-wrap border p-2 rounded-xs min-h-52 max-h-52">
                        {rec.description}
                      </p>
                    </div>
                  </>
                )}

                {/* SOLSCAN LINK */}
                {rec.txSignature && (
                  <div>
                    <div className="text-xs font-medium">
                      Transaction Signature
                    </div>
                    <a
                      href={`https://solscan.io/tx/${rec.txSignature}?cluster=devnet`}
                      className="flex items-center gap-2 text-blue-600 underline"
                      target="_blank"
                    >
                      View on Solscan <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}

                <Separator />

                {/* DOWNLOAD */}
                <div className="pt-3 border-t mt-3">
                  <Button
                    variant="secondary"
                    disabled={downloadAllowed[rec.pda] === false}
                    onClick={() => handleDecryptAndDownload(rec)}
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

      {/* NO RECORDS */}
      {hasGrant && !loading && records.length === 0 && (
        <p className="text-muted-foreground mt-4">No records found.</p>
      )}

      {/* PAGINATION */}
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

      {/* QR SCANNER */}
      {scanning && (
        <GeneralModal
          open={scanning}
          onOpenChange={setScanning}
          title="Scan Patient Pubkey"
          size="md"
          disablePadding
        >
          <div className="p-4">
            <QrScanner
              onResult={(pk) => {
                setPatientInput(pk);
                setScanning(false);
                toast.success("QR decoded successfully");
              }}
            />
          </div>
        </GeneralModal>
      )}

      {/* AI SUMMARY MODAL */}
      <AiRecordSummarizer
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        summaryText={summaryText}
        summaryLoading={summaryLoading}
        cachedSummary={cachedSummary}
        handleAISummary={handleAISummary}
      />
    </main>
  );
}
