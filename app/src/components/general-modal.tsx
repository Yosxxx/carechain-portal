"use client";

import * as React from "react";
import Image from "next/image";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface GeneralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  desc?: string;
  image?: string;
  copyable?: boolean;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  disablePadding?: boolean;
}

export function GeneralModal({
  open,
  onOpenChange,
  title = "Information",
  desc,
  image,
  copyable = false,
  children,
  size = "sm",
  disablePadding = false,
}: GeneralModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!desc) return;
    await navigator.clipboard.writeText(desc);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const sizeClass =
    size === "lg"
      ? "sm:max-w-[800px]"
      : size === "md"
      ? "sm:max-w-[500px]"
      : "sm:max-w-[400px]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${sizeClass} ${
          disablePadding ? "p-0" : "p-6"
        } flex flex-col items-center text-center gap-y-4`}
      >
        {/* Accessible title requirement (Radix) */}
        {disablePadding ? (
          // Hidden, but satisfies accessibility requirement
          <VisuallyHidden>
            <DialogTitle>{title}</DialogTitle>
          </VisuallyHidden>
        ) : (
          <DialogHeader className="w-full">
            <div className="flex justify-center items-center">
              <DialogTitle className="font-semibold text-lg">
                {title}
              </DialogTitle>
            </div>
          </DialogHeader>
        )}

        {image && (
          <div className="relative w-full h-[70vh] bg-black">
            <Image
              src={image}
              alt="modal image"
              fill
              className="object-contain select-none"
            />
          </div>
        )}

        {children && <div className="my-2">{children}</div>}

        {desc && (
          <DialogDescription className="flex items-center justify-center flex-col space-y-5">
            <div>{desc}</div>

            {copyable && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-xs w-full"
                onClick={handleCopy}
              >
                {copied ? (
                  "Copied"
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy
                  </>
                )}
              </Button>
            )}
          </DialogDescription>
        )}
      </DialogContent>
    </Dialog>
  );
}
