"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { SlidersHorizontal } from "lucide-react";

interface FilterButtonProps {
  options: { label: string; value: string | null }[];
  selected: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function FilterButton({
  options,
  selected,
  onChange,
  disabled = false,
}: FilterButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled}
          className={disabled ? "opacity-50 pointer-events-none" : ""}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={`w-50 mt-2 p-2 space-y-1 dark:bg-background ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {options.map((opt) => (
          <Button
            key={opt.label}
            variant={opt.value === selected ? "outline" : "ghost"}
            className="w-full justify-start"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(opt.value);
              setOpen(false);
            }}
          >
            {opt.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
