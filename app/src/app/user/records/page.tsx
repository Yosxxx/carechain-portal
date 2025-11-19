/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronsUpDown, ExternalLink, Search, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterButton } from "@/components/filter-button";
import { Separator } from "@/components/ui/separator";
import { StatusBanner } from "@/components/status-banner";
import { useProgram } from "@/hooks/useProgram";
import { findPatientPda } from "@/lib/pda";
import { Rec } from "@/types/Record";
import { deriveAttachmentStatus } from "@/lib/helper/attachments";
import { decryptAndDownloadHelper } from "@/lib/helper/decryptAndDownload";
import { fetchPatientRecords } from "@/lib/helper/fetchPatientRecords";
import { filterRecords, paginate } from "@/lib/helper/recordFilters";
import { showLoading, showSuccess, showError } from "@/lib/helper/toast";

export default function Page() {
  const { publicKey } = useWallet();
  const { program, programId, ready } = useProgram();

  // -------------------- State --------------------
  const [records, setRecords] = useState<Rec[]>([]);
  const [patientOk, setPatientOk] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState<
    Record<string, boolean>
  >({});
  const perPage = 5;

  // -------------------- Fetch On-Chain Records --------------------
  useEffect(() => {
    (async () => {
      setErr("");
      setRecords([]);
      setPatientOk(null);

      if (!ready || !program || !publicKey) return;

      try {
        setLoading(true);

        const patientPda = findPatientPda(programId, publicKey);

        // Is patient registered?
        // @ts-expect-error anchor typing
        const pAcc = await program.account.patient.fetchNullable(patientPda);

        if (!pAcc) {
          setPatientOk(false);
          return;
        }

        setPatientOk(true);

        // Fetch Records
        const out = await fetchPatientRecords(program, programId, patientPda);
        setRecords(out);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, program, programId, publicKey]);

  // -------------------- Check Attachments --------------------
  useEffect(() => {
    setAttachmentStatus(deriveAttachmentStatus(records));
  }, [records]);

  // -------------------- Decrypt & Download --------------------
  async function decryptAndDownload(rec: Rec) {
    if (attachmentStatus[rec.pda] === false) return;
    try {
      setDownloading(rec.pda);
      showLoading("Decrypting...", rec.pda);
      await decryptAndDownloadHelper(rec, setErr);
      showSuccess("Download complete", rec.pda);
    } catch (e: any) {
      showError(`Error: ${e?.message ?? "Decryption failed"}`);
    } finally {
      setDownloading(null);
    }
  }

  // -------------------- Filtering & Pagination --------------------
  const filteredRecords = useMemo(
    () => filterRecords(records, search, filterMode),
    [records, search, filterMode]
  );
  const paginated = useMemo(
    () => paginate(filteredRecords, page, perPage),
    [filteredRecords, page]
  );
  const totalPages = Math.ceil(filteredRecords.length / perPage);

  // -------------------- UI --------------------
  return (
    <main className="mb-5">
      {/* ===== Header ===== */}
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} /> Search for Records
        </div>
      </header>

      {/* ===== Status Banners ===== */}
      <div className="mt-2">
        {!publicKey && (
          <StatusBanner type="warning">
            ⚠️ Connect your Solana wallet to load your records.
          </StatusBanner>
        )}

        {loading && (
          <StatusBanner type="info">
            <Loader2 className="w-4 h-4 animate-spin" /> Fetching Records...
          </StatusBanner>
        )}

        {publicKey && patientOk === false && !loading && (
          <StatusBanner type="error">
            ❌ This wallet is not registered as a patient.
          </StatusBanner>
        )}

        {err && !loading && <StatusBanner type="error">⚠️ {err}</StatusBanner>}

        {patientOk && !loading && records.length > 0 && (
          <StatusBanner type="success">
            ✅ Successfully Fetched {records.length} Record
            {records.length > 1 ? "s" : ""}
          </StatusBanner>
        )}
      </div>

      {/* ===== Search + Filter ===== */}
      {patientOk && !loading && (
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Search Records"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Button variant={"outline"}>AI Summary</Button>
          <FilterButton
            options={[
              { label: "Default", value: null },
              { label: "Doctor (A-Z)", value: "doctor" },
              { label: "Hospital (A-Z)", value: "hospital" },
              { label: "Date ↑", value: "dateAsc" },
              { label: "Date ↓", value: "dateDesc" },
            ]}
            selected={filterMode}
            onChange={(val) => {
              setFilterMode(val);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* ===== Record List ===== */}
      {!loading && (
        <div className="flex flex-col gap-y-4 mt-5 mb-5">
          {paginated.map((rec) => (
            <Collapsible key={rec.pda} className="border p-4 rounded-xs">
              <CollapsibleTrigger className="w-full flex justify-between text-left items-center gap-4">
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
                <div className="text-sm text-muted-foreground text-right whitespace-nowrap">
                  {new Date(rec.createdAt).toLocaleDateString()}
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4 text-sm">
                {/* --- Metadata --- */}
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

                <Separator className="my-2" />

                {/* --- Description --- */}
                {rec.description && (
                  <div>
                    <div className="text-xs font-medium">Description</div>
                    <p className="whitespace-pre-wrap border p-2 rounded-xs min-h-52 max-h-52">
                      {rec.description}
                    </p>
                  </div>
                )}

                {/* --- Solscan Link --- */}
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

                {/* --- Download Button --- */}
                <div className="pt-3 border-t mt-3">
                  <Button
                    onClick={() => decryptAndDownload(rec)}
                    disabled={
                      attachmentStatus[rec.pda] === false ||
                      downloading === rec.pda
                    }
                    variant="secondary"
                  >
                    {attachmentStatus[rec.pda] === false
                      ? "No Attachments"
                      : downloading === rec.pda
                      ? "Decrypting..."
                      : "Download & Decrypt"}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {/* ===== Pagination ===== */}
      {!loading && filteredRecords.length > perPage && (
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
    </main>
  );
}
