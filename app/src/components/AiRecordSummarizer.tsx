"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface AiRecordSummarizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  summaryText: string;
  summaryLoading: boolean;
  cachedSummary: string | null;

  handleAISummary: (forceRefresh?: boolean) => void;
}

export default function AiRecordSummarizer({
  open,
  onOpenChange,
  summaryText,
  summaryLoading,
  cachedSummary,
  handleAISummary,
}: AiRecordSummarizerProps) {
  // Track if summary has ever been generated
  const firstRun = useRef(false);

  useEffect(() => {
    if (!open) return;

    // Run only once on very first open
    if (
      !firstRun.current &&
      !cachedSummary &&
      !summaryText &&
      !summaryLoading
    ) {
      firstRun.current = true;
      handleAISummary(false); // first-time generation
    }
  }, [open]);

  const showText = summaryText || cachedSummary || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[50vw]">
        <DialogHeader>
          <DialogTitle className="font-bold">AI Medical Summary</DialogTitle>
          <DialogDescription>
            <div>
              Automatically generated analysis based on your medical records.
            </div>

            {summaryLoading && (
              <div>Generating… safe to close this window.</div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* BODY */}
        <div className="mt-2">
          <div className="border rounded-xs p-4 max-h-[60vh] overflow-y-auto bg-background">
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {firstRun.current ? "Generating summary..." : "Regenerating..."}
              </div>
            ) : showText ? (
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {showText}
              </pre>
            ) : (
              <span className="text-muted-foreground text-sm">
                No summary generated yet.
              </span>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <DialogFooter className="mt-4 flex gap-2">
          {/* Copy */}
          <Button
            variant="outline"
            disabled={summaryLoading || !showText}
            onClick={() => navigator.clipboard.writeText(showText)}
          >
            Copy Summary
          </Button>

          {/* Regenerate */}
          <Button
            variant="outline"
            disabled={summaryLoading}
            onClick={() => handleAISummary(true)}
          >
            {summaryLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating...
              </span>
            ) : (
              "Regenerate Summary"
            )}
          </Button>

          {/* Close */}
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
