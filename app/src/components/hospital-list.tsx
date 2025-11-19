/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { GetPublicHospitalList } from "@/action/GetHospitalData";
import { useProgram } from "@/hooks/useProgram";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrCode, Loader2 } from "lucide-react";
import { GeneralModal } from "@/components/general-modal";
import { useQrScanner } from "@/components/useQrScanner";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { StatusBanner } from "@/components/status-banner";

export type HospitalItem = {
  authority_pubkey: string;
  name: string;
  address: string;
};

interface Props {
  onSelect: (h: HospitalItem) => void;
}

export default function HospitalList({ onSelect }: Props) {
  const { program, ready } = useProgram();

  const [merged, setMerged] = useState<HospitalItem[]>([]);
  const [search, setSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const { QrScanner } = useQrScanner();

  // LOAD HOSPITAL DATA
  useEffect(() => {
    if (!ready || !program) return;

    setLoading(true);
    setErr("");

    (async () => {
      try {
        // On-chain
        // @ts-expect-error anchor mismatch
        const all = await program.account.hospital.all();
        const onchain: string[] = all.map((h: any) =>
          h.account.authority.toBase58()
        );

        // Off-chain
        const meta = await GetPublicHospitalList();
        const map = new Map(meta.map((m: any) => [m.authority_pubkey, m]));

        // Merge
        const combined: HospitalItem[] = onchain.map((pk) => ({
          authority_pubkey: pk,
          name: map.get(pk)?.name ?? "Unknown Hospital",
          address: map.get(pk)?.address ?? "Unknown Address",
        }));

        setMerged(combined);
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? "Failed to load hospital list");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, program]);

  // FILTER
  const filtered = useMemo(() => {
    const s = search.toLowerCase().replaceAll(" ", "");

    return merged.filter((h) => {
      const name = h.name.toLowerCase();
      const addr = h.address.toLowerCase();
      const pub = h.authority_pubkey.toLowerCase();

      return name.includes(s) || addr.includes(s) || pub.includes(s);
    });
  }, [search, merged]);

  // PAGINATION
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="mt-2 space-y-4">
      {/* Search bar + QR */}
      <div className="flex gap-x-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, pubkey, or location"
          className="text-sm"
          disabled={!ready || loading}
        />

        <Button variant="outline" onClick={() => setScanOpen(true)}>
          <QrCode className="w-4 h-4" />
        </Button>
      </div>

      {loading && (
        <StatusBanner type="info">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="ml-2">Loading Hospitals...</span>
        </StatusBanner>
      )}

      {err && !loading && <StatusBanner type="error">❌ {err}</StatusBanner>}

      {/* Hospital Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginated.map((h) => (
          <div
            key={h.authority_pubkey}
            className="p-3 border rounded-xs cursor-pointer hover:bg-accent flex gap-3"
            onClick={() => onSelect(h)}
          >
            <div className="w-14 aspect-square bg-muted rounded-xs shrink-0" />

            <div className="flex flex-col min-w-0">
              <div className="font-bold text-sm truncate">{h.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {h.address}
              </div>
              {/* <div className="text-[10px] font-mono mt-1 break-all">
                {h.authority_pubkey}
              </div> */}
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filtered.length === 0 && !loading && !err && (
        <p className="text-sm text-muted-foreground text-center">
          No hospitals match your search.
        </p>
      )}

      {/* PAGINATION — ALWAYS SHOW */}
      <div className="flex justify-center mt-6">
        <Pagination>
          <PaginationContent>
            {/* Previous */}
            <PaginationItem>
              <PaginationPrevious
                onClick={() => page > 1 && setPage(page - 1)}
                className={
                  page === 1 || filtered.length === 0
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>

            {/* Page Links */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => filtered.length > 0 && setPage(p)}
                  className={
                    filtered.length === 0
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}

            {/* Next */}
            <PaginationItem>
              <PaginationNext
                onClick={() => page < totalPages && setPage(page + 1)}
                className={
                  page === totalPages || filtered.length === 0
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* QR Modal */}
      <GeneralModal
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="Scan Hospital QR"
        size="md"
        disablePadding
      >
        <div className="p-4">
          <QrScanner
            onResult={(text: string) => {
              setSearch(text.trim());
              setPage(1);
              setScanOpen(false);
            }}
          />
        </div>
      </GeneralModal>
    </div>
  );
}
