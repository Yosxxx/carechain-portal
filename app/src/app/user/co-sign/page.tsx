/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBanner } from "@/components/status-banner";
import { useQrScanner } from "@/components/useQrScanner";
import { FilePen, QrCodeIcon, X } from "lucide-react";

export default function CoSignPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const params = useSearchParams();
  const { QrScanner } = useQrScanner();

  // ─── State ──────────────────────────────────────────────
  const [b64, setB64] = useState("");
  const [status, setStatus] = useState("");
  const [scanModalOpen, setScanModalOpen] = useState(false);

  // ─── Auto-fill transaction from ?tx= query ─────────────
  useEffect(() => {
    const q = params.get("tx");
    if (q) setB64(q);
  }, [params]);

  const canSign = useMemo(
    () => !!publicKey && !!signTransaction,
    [publicKey, signTransaction]
  );

  // ─── Decode, sign, and submit transaction ───────────────
  const coSignAndSend = async () => {
    try {
      if (!canSign) throw new Error("Connect patient wallet first.");
      if (!b64.trim()) throw new Error("No transaction provided.");

      setStatus("Decoding transaction...");
      const tx = Transaction.from(Buffer.from(b64.trim(), "base64"));

      setStatus("Signing...");
      const signed = await signTransaction!(tx);

      setStatus("Sending...");
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setStatus(`✅ Submitted: ${sig}`);
      toast.success("Transaction Sent");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || String(e)}`);
      toast.error("Transaction Failed");
    }
  };

  return (
    <main className="my-5">
      <div className="flex flex-col">
        <header className="font-architekt p-2 border rounded-xs mb-2">
          <div className="flex font-bold gap-x-2 items-center">
            <FilePen size={20} /> CO-SIGN TRANSACTIONS
          </div>
        </header>

        {/* ─── Base64 Input ───────────────────────────────────────── */}
        <Textarea
          className="w-full p-2 text-xs font-mono h-92"
          placeholder="Paste or scan the base64 transaction..."
          value={b64}
          onChange={(e) => setB64(e.target.value)}
        />

        {/* ─── Action Buttons ─────────────────────────────────────── */}
        <div className="flex justify-between gap-x-5 my-5 w-full">
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => setScanModalOpen(true)}
          >
            Scan QR <QrCodeIcon className="ml-2 w-4 h-4" />
          </Button>

          <Button
            className="flex-1"
            variant="default"
            disabled={!canSign}
            onClick={coSignAndSend}
          >
            Sign & Submit
          </Button>
        </div>

        {/* ─── Status Banner ─────────────────────────────────────── */}
        {status && (
          <StatusBanner
            type={
              status.startsWith("❌")
                ? "error"
                : status.startsWith("✅")
                ? "success"
                : status.startsWith("⚠️")
                ? "warning"
                : "info"
            }
          >
            {status}
          </StatusBanner>
        )}

        {/* ─── QR Scanner Modal ───────────────────────────────────── */}
        {scanModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-6">
            <div className="bg-card rounded-xl shadow-lg p-4 w-full max-w-sm">
              <QrScanner
                onResult={(text) => {
                  setB64(text);
                  setScanModalOpen(false);
                  setStatus("✅ QR decoded successfully.");
                }}
              />
            </div>

            <Button
              variant="destructive"
              className="mt-5"
              onClick={() => setScanModalOpen(false)}
            >
              <X className="w-4 h-4 mr-2" /> Close Scanner
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
