"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QrDisplayProps {
  value: string;
  onRefresh?: () => Promise<void> | void;
  onBack?: () => void;
  title?: string;
}

/**
 * Renders a standardized QR display block for base64 transaction sharing.
 * Includes copy, refresh, and optional back navigation.
 */
export function QrDisplay({
  value,
  onRefresh,
  onBack,
  title = "Scan this QR on the patient's device",
}: QrDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied QR payload to clipboard");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {/* --- Title --- */}
      <p className="text-sm text-muted-foreground">{title}</p>

      {/* --- QR Image --- */}
      <div className="p-3 border rounded bg-white dark:bg-black">
        <QRCodeCanvas value={value} size={256} level="L" includeMargin />
      </div>

      {/* --- Payload + Actions --- */}
      <div className="flex flex-col items-center gap-3 w-full">
        <p className="text-xs text-muted-foreground break-all max-w-[90%] text-center">
          {value.slice(0, 64)}...
        </p>

        <div className="flex gap-2 flex-wrap w-full justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1 sm:flex-none"
          >
            {copied ? "Copied!" : "Copy Payload"}
          </Button>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex-1 sm:flex-none"
            >
              Refresh TX
            </Button>
          )}

          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex-1 sm:flex-none"
            >
              Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
