// /hooks/useWalletDid.ts
"use client";
import { useState, useCallback, useEffect } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { deriveWalletDidFromPublicKey } from "@/lib/did";

/**
 * Hook: Derives and maintains a DID reactively based on the connected wallet.
 */
export function useWalletDid() {
  const wallet = useAnchorWallet();
  const [did, setDid] = useState("");
  const [err, setErr] = useState("");

  const derive = useCallback(() => {
    try {
      if (!wallet?.publicKey) throw new Error("Wallet not connected");
      const didStr = deriveWalletDidFromPublicKey(wallet.publicKey);
      setDid(didStr);
      setErr("");
    } catch (e: any) {
      setDid("");
      setErr(e?.message ?? String(e));
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet?.publicKey) derive();
  }, [wallet, derive]);

  return { did, err, derive };
}
