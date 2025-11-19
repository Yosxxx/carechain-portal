"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import JSZip from "jszip";
import { QrCode, X, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GeneralModal } from "@/components/general-modal";
import { useQrScanner } from "@/components/useQrScanner";
import { addMedicationAction } from "@/action/GetMedication";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface ConceptProperty {
  name: string;
}

interface ConceptGroup {
  conceptProperties?: ConceptProperty[];
}

export default function Page() {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [drugs, setDrugs] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  const { QrScanner } = useQrScanner();
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const [form, setForm] = useState({
    patient_pubkey: "",
    doctor_name: "",
    diagnosis: "",
    keywords: "",
    description: "",
  });

  const handleInput = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // -----------------------------------------------------------------------
  // SEARCH MEDICATION SUGGESTIONS (useEffect + debounce)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      try {
        setSuggestLoading(true);

        const spellRes = await fetch(
          `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${search}`
        );
        const spellJson = await spellRes.json();
        const list: string[] =
          spellJson?.suggestionGroup?.suggestionList?.suggestion || [];

        const terms = list.length > 0 ? list : [search];

        const collected: string[] = [];

        for (const term of terms.slice(0, 5)) {
          const r = await fetch(
            `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${term}`
          );
          const j = await r.json();

          const groups: ConceptGroup[] = j.drugGroup?.conceptGroup || [];
          const names = groups
            .flatMap((g) => g.conceptProperties || [])
            .map((c) => c.name);

          collected.push(...names);
        }

        const finalList = [...new Set(collected)].slice(0, 20);

        if (active) setSuggestions(finalList);
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setSuggestLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  // -----------------------------------------------------------------------
  // ADD DRUG USING SERVER ACTION
  // -----------------------------------------------------------------------
  const addDrugAsync = async (raw: string) => {
    const formatted = await addMedicationAction(raw);
    setDrugs((prev) => [...prev, formatted]);
    setSuggestions([]);
    setSearch("");
    if (searchRef.current) searchRef.current.value = "";
  };

  const removeDrug = (name: string) => {
    setDrugs((prev) => prev.filter((d) => d !== name));
  };

  const handleResetMedication = () => {
    setSearch("");
    setSuggestions([]);
    if (searchRef.current) searchRef.current.value = "";
  };

  const handleResetDrugs = () => setDrugs([]);

  // -----------------------------------------------------------------------
  // IMAGE HANDLING
  // -----------------------------------------------------------------------
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    const allowed = selected.slice(0, 5 - files.length);
    const newPreviews = allowed.map((file) => URL.createObjectURL(file));
    setFiles((prev) => [...prev, ...allowed]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleDeleteImage = (index: number) => {
    const f = [...files];
    const p = [...previews];
    f.splice(index, 1);
    p.splice(index, 1);
    setFiles(f);
    setPreviews(p);
  };

  // -----------------------------------------------------------------------
  // ZIP DOWNLOAD
  // -----------------------------------------------------------------------
  const handleDownloadZip = async () => {
    const zip = new JSZip();

    const record = { ...form, medications: drugs };
    zip.file("medical_record.json", JSON.stringify(record, null, 2));

    for (const file of files) {
      zip.file(`images/${file.name}`, file);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "medical_record_bundle.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // -----------------------------------------------------------------------

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="min-w-lg max-w-lg flex flex-col gap-y-5">
        <h1 className="text-2xl font-bold">Append Medical Record</h1>

        {/* PUBKEY */}
        <div>
          <Label className="mb-1">Patient Pubkey</Label>
          <div className="flex gap-3 mt-1">
            <Input
              value={form.patient_pubkey}
              onChange={(e) => handleInput("patient_pubkey", e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => setScanModalOpen(true)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Doctor */}
        <div>
          <Label className="mb-1">Doctor Name</Label>
          <Input
            value={form.doctor_name}
            onChange={(e) => handleInput("doctor_name", e.target.value)}
          />
        </div>

        {/* SEARCH MEDICATION */}
        <div className="relative">
          <Label className="mb-1">Search Medication</Label>

          <div className="flex gap-x-2">
            <Input
              ref={searchRef}
              placeholder="Type Medicine Name..."
              onChange={(e) => setSearch(e.target.value)}
            />

            <Button variant="destructive" onClick={handleResetMedication}>
              Clear
            </Button>
          </div>

          {suggestLoading && (
            <div className="absolute bg-card mt-2 p-2 border text-sm flex gap-2 items-center">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="absolute bg-card mt-2 w-full border shadow z-20 max-h-56 overflow-y-auto">
              {suggestions.map((s) => (
                <div
                  key={s}
                  className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                  onClick={() => addDrugAsync(s)}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {drugs.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label className="mb-1">Medications (Optional)</Label>

            <TooltipProvider>
              <div className="grid grid-cols-4 gap-2">
                {drugs.map((d, i) => (
                  <Tooltip key={`${d}-${i}`}>
                    <TooltipTrigger asChild>
                      <div
                        onClick={() => removeDrug(d)}
                        className="
                  w-full h-10
                  border rounded-xs
                  cursor-pointer select-none
                  bg-card hover:bg-destructive hover:text-white
                  flex items-center justify-center text-center
                  transition overflow-hidden
                "
                      >
                        <span className="truncate w-full px-1">{d}</span>
                      </div>
                    </TooltipTrigger>

                    <TooltipContent side="top" className="rounded-xs">
                      <p>{d}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>

            <Button
              variant="destructive"
              onClick={handleResetDrugs}
              className="w-fit"
            >
              Clear Medications
            </Button>
          </div>
        )}

        {/* FORM FIELDS */}
        <div>
          <Label className="mb-1">Diagnosis</Label>
          <Input
            value={form.diagnosis}
            onChange={(e) => handleInput("diagnosis", e.target.value)}
          />
        </div>

        <div>
          <Label className="mb-1">Keywords</Label>
          <Input
            value={form.keywords}
            onChange={(e) => handleInput("keywords", e.target.value)}
          />
        </div>

        <div>
          <Label className="mb-1">Description</Label>
          <Textarea
            rows={5}
            value={form.description}
            onChange={(e) => handleInput("description", e.target.value)}
          />
        </div>

        {/* IMAGES */}
        <div>
          <Label className="mb-1">Medical Images (Optional, max 5)</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
          />

          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {previews.map((src, i) => (
                <div
                  key={src}
                  className="relative border rounded overflow-hidden aspect-square"
                >
                  <Image src={src} alt="" fill className="object-cover" />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                    onClick={() => handleDeleteImage(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" onClick={handleDownloadZip}>
          Download ZIP
        </Button>
      </div>

      {/* QR SCANNER MODAL */}
      <GeneralModal
        open={scanModalOpen}
        onOpenChange={setScanModalOpen}
        title="Scan Patient Pubkey"
        size="md"
        disablePadding
      >
        <div className="p-4">
          <QrScanner
            onResult={(text) => {
              setForm((f) => ({ ...f, patient_pubkey: text }));
              setScanModalOpen(false);
            }}
          />
        </div>
      </GeneralModal>
    </main>
  );
}
