"use client";

import { useState } from "react";
import { Scanner, useDevices } from "@yudiel/react-qr-scanner";
import { toast } from "sonner";
import { QrCode } from "lucide-react";

export interface QrScannerProps {
  onResult: (value: string) => void;
  label?: string; // optional custom label
}

export function useQrScanner() {
  const devices = useDevices();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const QrScanner = ({
    onResult,
    label = "Scan a QR code",
  }: QrScannerProps) => (
    <div className="flex flex-col items-center justify-center p-6 gap-5 text-center">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-2 font-semibold">
          <QrCode className="w-5 h-5" />
          <span>{label}</span>
        </div>
        <p className="text-xs text-muted-foreground max-w-sm">
          Align the QR code inside the square frame below. The scan will occur
          automatically.
        </p>
      </div>

      {/* Scanner Container */}
      <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden shadow-lg ring-1 ring-border">
        <Scanner
          allowMultiple={false}
          constraints={{
            facingMode: "environment",
            deviceId: selectedDevice || undefined,
          }}
          components={{
            finder: true,
          }}
          onScan={(result) => {
            if (result?.[0]?.rawValue) {
              const text = result[0].rawValue.trim();
              onResult(text);
              toast.success("QR scanned successfully!");
            }
          }}
          onError={(error) => {
            console.error(error);
            toast.error("Camera error or permission denied");
          }}
        />
      </div>

      {/* Camera Selector */}
      {devices.length > 1 && (
        <div className="flex flex-col items-center gap-1">
          <label className="text-xs text-muted-foreground">Camera Source</label>
          <select
            className="text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1"
            onChange={(e) => setSelectedDevice(e.target.value || null)}
            value={selectedDevice ?? ""}
          >
            <option value="">Default Camera</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  return { QrScanner };
}
