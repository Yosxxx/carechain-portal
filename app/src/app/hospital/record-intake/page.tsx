"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

// --- React & Next.js Imports ---
import { useState, useEffect, ChangeEvent, useMemo } from "react";
import Image from "next/image";

// --- Library Imports ---
import JSZip from "jszip";
import { toast } from "sonner";
import bs58 from "bs58";

// --- Solana Imports ---
import * as anchor from "@coral-xyz/anchor";
import {
  useConnection,
  useAnchorWallet,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

// --- Local Imports ---
import idl from "../../../../anchor.json";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBanner } from "@/components/status-banner";
import { GeneralModal } from "@/components/general-modal";
import { QrDisplay } from "@/components/qr-display";
import { GetCurrentHospitalData } from "@/action/GetHospitalData";
import { refreshCosignTxHelper } from "@/lib/helper/refreshCosignTx";
import {
  findPatientPda,
  findConfigPda,
  findPatientSeqPda,
  findHospitalPda,
  findGrantPda,
} from "@/lib/pda";
import { MedicalRecordIntake, HospitalData } from "@/types/Record";

// ========================================================================
//  UTILITY FUNCTIONS
// ========================================================================

const u8ToB64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64");
const hexToU8 = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));
const b64ToU8 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

/**
 * Calls the API endpoint to encrypt and upload the file.
 * This is moved outside the component as it doesn't rely on component state
 * (record is now passed as an argument).
 */
async function encUpload(
  file: File,
  patientPk_b64: string,
  hospitalPk_b64: string,
  record: MedicalRecordIntake | null
): Promise<{
  cidEnc: string;
  metaCid: string;
  sizeBytes: number;
  cipherHashHex: string;
  edekRoot_b64: string;
  edekPatient_b64: string;
  edekHospital_b64: string;
  kmsRef: string;
}> {
  if (!file) throw new Error("No file provided for upload");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("contentType", file.type || "application/octet-stream");
  fd.append("patientPk_b64", patientPk_b64);
  fd.append("rsCreatorPk_b64", hospitalPk_b64);

  // Append metadata from the record object
  if (record) {
    fd.append("hospital_name", record.hospital_name || "");
    fd.append("doctor_name", record.doctor_name || "");
    fd.append("diagnosis", record.diagnosis || "");
    fd.append("keywords", record.keywords || "");
    fd.append("description", record.description || "");
  }

  const r = await fetch("/api/enc-upload", { method: "POST", body: fd });

  const text = await r.text();
  if (!r.ok) throw new Error(text);
  return JSON.parse(text);
}

// ========================================================================
//  MAIN COMPONENT
// ========================================================================

export default function Page() {
  // --- Form & Data State ---
  const [record, setRecord] = useState<MedicalRecordIntake | null>(null);
  const [original, setOriginal] = useState<MedicalRecordIntake | null>(null);
  const [zipName, setZipName] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [images, setImages] = useState<{ name: string; blob: Blob }[]>([]);
  const [hospitalData, setHospitalData] = useState<HospitalData | null>(null);

  // --- UI & Status State ---
  const [view, setView] = useState<"form" | "loading" | "qr">("form");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Live Check State ---
  const [patientCheckStatus, setPatientCheckStatus] = useState<string | null>(
    null
  );
  const [hospitalOk, setHospitalOk] = useState<boolean | null>(null);
  const [patientAccountOk, setPatientAccountOk] = useState<boolean | null>(
    null
  );
  const [grantOk, setGrantOk] = useState<boolean | null>(null);
  const [grantErr, setGrantErr] = useState<string>("");

  // --- Co-Sign State ---
  const [lastIx, setLastIx] = useState<TransactionInstruction | null>(null);
  const [coSignBase64, setCoSignBase64] = useState("");

  // --- Solana Hooks & Program Setup ---
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { signTransaction: waSignTx } = useWallet();

  const programId = useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );

  const provider = useMemo(
    () =>
      wallet
        ? new anchor.AnchorProvider(connection, wallet, {
            commitment: "confirmed",
          })
        : null,
    [connection, wallet]
  );

  const program = useMemo(
    () => (provider ? new anchor.Program(idl as anchor.Idl, provider) : null),
    [provider]
  );

  const patientPk = useMemo(() => {
    if (!record?.patient_pubkey) return null;
    try {
      return new PublicKey(record.patient_pubkey.trim());
    } catch {
      return null;
    }
  }, [record?.patient_pubkey]);

  // --- Side Effects & On-Chain Checks ---

  // Check 1: Is connected wallet a registered hospital?
  useEffect(() => {
    (async () => {
      if (!program || !wallet?.publicKey) {
        setHospitalOk(null);
        return;
      }
      try {
        const hospitalPda = findHospitalPda(
          program.programId,
          wallet.publicKey
        );
        // @ts-expect-error anchor typing
        const hAcc = await program.account.hospital.fetchNullable(hospitalPda);
        setHospitalOk(!!hAcc);
      } catch {
        setHospitalOk(false);
      }
    })();
  }, [program, wallet?.publicKey]);

  // Check 2: Does the patient pubkey exist?
  useEffect(() => {
    const checkPatient = async () => {
      if (!program || !patientPk) {
        setPatientAccountOk(null);
        if (record?.patient_pubkey) {
          setPatientCheckStatus("❌ Invalid Pubkey Format");
        } else {
          setPatientCheckStatus(null);
        }
        return;
      }

      try {
        setPatientCheckStatus("Checking patient account...");
        const patientPda = findPatientPda(program.programId, patientPk);
        // @ts-expect-error anchor typing
        const pAcc = await program.account.patient.fetchNullable(patientPda);

        if (pAcc) {
          setPatientAccountOk(true);
          setPatientCheckStatus("✅ Patient account exists on-chain.");
        } else {
          setPatientAccountOk(false);
          setPatientCheckStatus(
            "❌ Patient account not found (not registered)."
          );
        }
      } catch (e: any) {
        setPatientAccountOk(false);
        setPatientCheckStatus(`Error: ${e.message}`);
      }
    };

    checkPatient();
  }, [program, patientPk?.toBase58(), record?.patient_pubkey]); // Added record dependency

  // Check 3: Does this hospital have a Write Grant from this patient?
  useEffect(() => {
    (async () => {
      setGrantErr("");
      if (!program || !wallet?.publicKey || !patientPk) {
        setGrantOk(null);
        return;
      }
      try {
        const patientPda = findPatientPda(program.programId, patientPk);
        const grantWritePda = findGrantPda(
          program.programId,
          patientPda,
          wallet.publicKey,
          2 // GrantLevel.Write
        );
        // @ts-expect-error anchor typing
        const gAcc = await program.account.grant.fetchNullable(grantWritePda);
        if (!gAcc) {
          setGrantOk(false);
          setGrantErr("Grant not found");
          return;
        }
        if (gAcc.revoked) {
          setGrantOk(false);
          setGrantErr("Grant revoked");
          return;
        }
        setGrantOk(true);
      } catch (e: any) {
        setGrantOk(false);
        setGrantErr(e?.message ?? "Grant check failed");
      }
    })();
  }, [program, wallet?.publicKey, patientPk?.toBase58()]);

  // Effect 4: Fetch hospital info on load
  useEffect(() => {
    const fetchHospital = async () => {
      try {
        const data = await GetCurrentHospitalData();
        setHospitalData(data);
      } catch (err: unknown) {
        if (err instanceof Error)
          console.error("Failed to fetch hospital data:", err.message);
      }
    };
    fetchHospital();
  }, []);

  // --- Event Handlers ---

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("medical_record.json");
      if (!jsonFile) {
        alert("medical_record.json not found");
        return;
      }

      const jsonText = await jsonFile.async("string");
      const data: MedicalRecordIntake = JSON.parse(jsonText);
      setRecord(data);
      setOriginal(data);
      setZipName(file.name);

      // Extract images
      const imgs = await Promise.all(
        Object.values(zip.files)
          .filter((f) => /\.(jpe?g|png|webp|bmp)$/i.test(f.name) && !f.dir)
          .map(async (f) => ({ name: f.name, blob: await f.async("blob") }))
      );
      setImages(imgs);
      setPreviews(imgs.map((i) => URL.createObjectURL(i.blob)));

      // Auto-fill hospital info if available
      if (hospitalData) {
        setRecord((prev) =>
          prev
            ? {
                ...prev,
                hospital_pubkey: hospitalData.authority_pubkey,
                hospital_name: hospitalData.name,
              }
            : prev
        );
      }
    } catch (err: unknown) {
      console.error("Error reading zip:", err);
      alert("Failed to parse zip");
    }
  };

  const handleChange = (key: keyof MedicalRecordIntake, value: string) =>
    record && setRecord({ ...record, [key]: value });

  const handleReset = (key: keyof MedicalRecordIntake) =>
    record && original && setRecord({ ...record, [key]: original[key] });

  const handleFill = () => {
    if (!record || !hospitalData) return;
    setRecord({
      ...record,
      hospital_pubkey: hospitalData.authority_pubkey,
      hospital_name: hospitalData.name,
    });
  };

  const handleDownloadZip = async () => {
    if (!record) return;

    const zip = new JSZip();
    zip.file("medical_record.json", JSON.stringify(record, null, 2));
    images.forEach((img) => zip.file(img.name, img.blob));

    const blob = await zip.generateAsync({ type: "blob" });

    // Filename structure: patient_pubkey + hospital_pubkey + date
    const patientKey =
      record.patient_pubkey?.replace(/[^a-zA-Z0-9_-]/g, "") ||
      "unknown_patient";
    const hospitalKey =
      record.hospital_pubkey?.replace(/[^a-zA-Z0-9_-]/g, "") ||
      "unknown_hospital";

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .split(".")[0];

    const filename = `${patientKey}_${hospitalKey}_${timestamp}.zip`;

    // Download trigger
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const refreshCosignTx = async () => {
    try {
      if (!wallet || !lastIx) return;
      setStatus("Refreshing co-sign transaction...");

      const b64 = await refreshCosignTxHelper(
        connection,
        wallet,
        waSignTx,
        lastIx
      );

      setCoSignBase64(b64);
      setStatus("Share the new link/base64 with the patient.");
      toast.success("Transaction refreshed.");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setStatus(`❌ ${msg}`);
      toast.error(`Failed to refresh: ${msg}`);
    }
  };

  const handleClearUpload = () => {
    setRecord(null);
    setOriginal(null);
    setZipName(null);
    setImages([]);
    setPreviews([]);
    setStatus("");
    setPatientCheckStatus(null);
    setHospitalOk(null);
    setPatientAccountOk(null);
    setGrantOk(null);
    setGrantErr("");
    setCoSignBase64("");
    setLastIx(null);

    // Reset the file input value
    const input = document.getElementById(
      "zip-input"
    ) as HTMLInputElement | null;
    if (input) input.value = "";

    console.log("Upload cleared and all states reset.");
  };

  // --- Derived State ---
  const readyToSubmit =
    !!program &&
    !!wallet?.publicKey &&
    !!patientPk &&
    !!record &&
    hospitalOk === true &&
    patientAccountOk === true &&
    grantOk === true;

  // --- Core Submit Logic ---

  const handleSubmitOnChain = async () => {
    setCoSignBase64("");
    setIsSubmitting(true);
    setView("loading"); // 🔄 switch to spinner view immediately

    try {
      // --- 1. Pre-flight Checks ---
      setStatus("Checking preconditions...");
      if (!program || !wallet || !patientPk || !record)
        throw new Error("Program, wallet, patient, or record missing");
      if (!hospitalOk)
        throw new Error("Hospital not registered for this wallet.");
      if (!patientAccountOk)
        throw new Error("Patient not registered. Ask them to upsert first.");
      if (!grantOk)
        throw new Error(
          grantErr || "Write access not granted by this patient."
        );

      // --- 2. Prepare Data & PDAs ---
      setStatus("Deriving PDAs...");
      const configPda = findConfigPda(programId);
      const patientPda = findPatientPda(programId, patientPk);
      const patientSeqPda = findPatientSeqPda(programId, patientPda);
      const hospitalPda = findHospitalPda(programId, wallet.publicKey);
      const grantWritePda = findGrantPda(
        programId,
        patientPda,
        wallet.publicKey,
        2 // GrantLevel.Write
      );

      const patientPk_b64 = u8ToB64(bs58.decode(record.patient_pubkey.trim()));
      const hospitalPk_b64 = u8ToB64(wallet.publicKey.toBytes());

      // --- 3. ZIP Data ---
      setStatus("Zipping record...");
      const zip = new JSZip();
      zip.file("medical_record.json", JSON.stringify(record, null, 2));
      images.forEach((img) => zip.file(img.name, img.blob));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const finalZipFile = new File([zipBlob], zipName || "record.zip", {
        type: "application/zip",
      });

      // --- 4. Encrypt & Upload to API ---
      setStatus("Encrypting & uploading zip...");
      const {
        cidEnc,
        metaCid,
        sizeBytes,
        cipherHashHex,
        edekRoot_b64,
        edekPatient_b64,
        edekHospital_b64,
        kmsRef,
      } = await encUpload(finalZipFile, patientPk_b64, hospitalPk_b64, record); // Pass record

      // --- 5. Prepare On-Chain Arguments ---
      setStatus("Fetching patient sequence...");
      // @ts-expect-error anchor typing
      const patientSeq = await program.account.patientSeq.fetch(patientSeqPda);
      const seq = new anchor.BN(patientSeq.value);

      const metaMime = "application/zip";
      const sizeBn = new anchor.BN(sizeBytes);
      const hash32 = Array.from(hexToU8(cipherHashHex));
      const edekRoot = Buffer.from(b64ToU8(edekRoot_b64));
      const edekForPatient = Buffer.from(b64ToU8(edekPatient_b64));
      const edekForHospital = Buffer.from(b64ToU8(edekHospital_b64));

      // --- 6. Build Instruction ---
      setStatus("Building transaction instruction...");
      const recordPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("record"),
          patientPda.toBuffer(),
          seq.toArrayLike(Buffer, "le", 8),
        ],
        programId
      )[0];

      const method = program.methods
        .createRecord(
          seq,
          cidEnc,
          metaMime,
          metaCid,
          sizeBn,
          hash32,
          edekRoot,
          edekForPatient,
          edekForHospital,
          { kms: {} },
          { kms: {} },
          { kms: {} },
          kmsRef,
          1, // schema_version
          { xChaCha20: {} },
          record.hospital_name || "",
          record.doctor_name || ""
        )
        .accounts({
          uploader: wallet.publicKey,
          payer: patientPk, // Patient pays for the record creation
          config: configPda,
          patient: patientPda,
          patientSeq: patientSeqPda,
          hospital: hospitalPda,
          grantWrite: grantWritePda,
          record: recordPda,
          systemProgram: SystemProgram.programId,
        });

      // --- 7. Handle Single-Signer (Test) vs. Co-Signer ---
      if (wallet.publicKey.equals(patientPk)) {
        setStatus("Submitting (single-signer test path)...");
        const sig = await method.rpc();
        toast.success(`Transaction confirmed: ${sig}`);
        setView("form");
        return;
      }

      // --- 8. Create Co-Sign Transaction ---
      setStatus("Building instruction...");
      const ix = await method.instruction();
      setLastIx(ix);

      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const ltx = new Transaction({
        feePayer: wallet.publicKey, // Hospital pays for the co-sign setup
        recentBlockhash: blockhash,
      }).add(ix);

      if (!waSignTx)
        throw new Error(
          "This wallet cannot sign transactions. Use Phantom/Backpack/Solflare."
        );

      // Hospital signs their part
      const signedByHospital = await waSignTx(ltx);
      const b64 = Buffer.from(
        signedByHospital.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setCoSignBase64(b64);
      setView("qr"); // ✅ show QR code page
      toast.success(
        "Transaction created successfully. Awaiting patient co-sign."
      );
    } catch (e: any) {
      const msg = e?.message || e?.toString?.() || "Unknown error";
      setStatus(`❌ ${msg}`);
      setView("form"); // ⏪ re-render form
      toast.error(`Failed to initialize transaction: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  //  RENDER
  // ========================================================================

  return (
    <main className="my-6 min-h-[70vh] flex items-center justify-center">
      {/* ========== 1. LOADING VIEW ========== */}
      {view === "loading" && (
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-t-transparent border-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{status || "..."}</p>
        </div>
      )}

      {/* ========== 2. QR VIEW ========== */}
      {view === "qr" && coSignBase64 && (
        <QrDisplay
          value={coSignBase64}
          onRefresh={refreshCosignTx}
          onBack={() => setView("form")}
          title="Scan this QR to load the transaction on the patient's device"
        />
      )}

      {/* ========== 3. FORM VIEW ========== */}
      {view === "form" && (
        <div className="w-full mx-auto">
          <Input
            id="zip-input"
            type="file"
            accept=".zip"
            onChange={handleFileUpload}
            className="mb-5"
          />

          {/* --- STATUS BANNERS --- */}
          <div className="space-y-2 mb-4">
            {hospitalOk === false ? (
              <StatusBanner type="error">
                ❌ Current Wallet Is Not A Registered Hospital Authority.
              </StatusBanner>
            ) : patientAccountOk === false && record?.patient_pubkey ? (
              <StatusBanner type="error">
                ⚠️ Patient Not Registered.
              </StatusBanner>
            ) : grantOk === false ? (
              <StatusBanner type="warning">
                ⚠️ Write Grant Missing:{" "}
                {grantErr ||
                  "Patient Must Grant Write Access To This Hospital."}
              </StatusBanner>
            ) : hospitalOk && patientAccountOk && grantOk ? (
              <StatusBanner type="success">✅ All Checks Passed</StatusBanner>
            ) : null}
          </div>

          {/* --- RECORD FORM --- */}
          {record && zipName && (
            <section className="flex flex-col gap-y-3 border p-3 mt-5 rounded-xs">
              <h1 className="text-2xl font-bold font-architekt">{zipName}</h1>

              <div className="flex flex-col gap-8 mt-6">
                {/* ──────────────── 🧩 PATIENT SECTION ──────────────── */}
                <section>
                  <h2 className="font-bold mb-3 text-lg">
                    Patient Information
                  </h2>

                  <div>
                    <label className="font-medium">Patient Pubkey</label>
                    <div className="flex gap-2">
                      <Input
                        value={record.patient_pubkey ?? ""}
                        onChange={(e) =>
                          handleChange("patient_pubkey", e.target.value)
                        }
                      />
                      <Button
                        variant="outline"
                        onClick={() => handleReset("patient_pubkey")}
                      >
                        Revert
                      </Button>
                    </div>
                    {patientCheckStatus && (
                      <p
                        className={`mt-1 text-sm ${
                          patientCheckStatus.startsWith("✅")
                            ? "text-emerald-600"
                            : patientCheckStatus.startsWith("❌")
                            ? "text-red-600"
                            : "text-gray-500"
                        }`}
                      >
                        {patientCheckStatus}
                      </p>
                    )}
                  </div>
                </section>

                {/* ──────────────── 🏥 DOCTOR & HOSPITAL SECTION ──────────────── */}
                <section>
                  <h2 className="font-bold mb-3 text-lg">
                    Doctor & Hospital Details
                  </h2>

                  <div className="flex flex-col gap-y-5">
                    {/* Doctor Name */}
                    <div>
                      <label className="font-medium">Doctor Name</label>
                      <div className="flex gap-2">
                        <Input
                          value={record.doctor_name ?? ""}
                          onChange={(e) =>
                            handleChange("doctor_name", e.target.value)
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleReset("doctor_name")}
                        >
                          Revert
                        </Button>
                      </div>
                    </div>

                    {/* Hospital Pubkey */}
                    <div>
                      <label className="font-medium">Hospital Pubkey</label>
                      <div className="flex gap-2">
                        <Input
                          value={record.hospital_pubkey ?? ""}
                          onChange={(e) =>
                            handleChange("hospital_pubkey", e.target.value)
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleReset("hospital_pubkey")}
                        >
                          Revert
                        </Button>
                        <Button onClick={handleFill} variant="secondary">
                          Fill
                        </Button>
                      </div>
                    </div>

                    {/* Hospital Name */}
                    <div>
                      <label className="font-medium">Hospital Name</label>
                      <div className="flex gap-2">
                        <Input
                          value={record.hospital_name ?? ""}
                          onChange={(e) =>
                            handleChange("hospital_name", e.target.value)
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleReset("hospital_name")}
                        >
                          Revert
                        </Button>
                        <Button onClick={handleFill} variant="secondary">
                          Fill
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ──────────────── 📋 RECORD SECTION ──────────────── */}
                <section>
                  <h2 className="font-bold mb-3 text-lg">Record Details</h2>

                  <div className="flex flex-col gap-4">
                    {/* Diagnosis */}
                    <div>
                      <label className="font-medium">Diagnosis</label>
                      <div className="flex gap-2">
                        <Textarea
                          value={record.diagnosis ?? ""}
                          onChange={(e) =>
                            handleChange("diagnosis", e.target.value)
                          }
                          className="min-h-[80px] w-full"
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleReset("diagnosis")}
                        >
                          Revert
                        </Button>
                      </div>
                    </div>

                    {/* Keywords */}
                    <div>
                      <label className="font-medium">Keywords</label>
                      <div className="flex gap-2">
                        <Textarea
                          value={record.keywords ?? ""}
                          onChange={(e) =>
                            handleChange("keywords", e.target.value)
                          }
                          className="min-h-[80px] w-full"
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleReset("keywords")}
                        >
                          Revert
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="font-medium">Description</label>
                      <div className="flex gap-2">
                        <Textarea
                          value={record.description ?? ""}
                          onChange={(e) =>
                            handleChange("description", e.target.value)
                          }
                          className="min-h-[120px] w-full"
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleReset("description")}
                        >
                          Revert
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ──────────────── 🖼️ PREVIEW SECTION ──────────────── */}
                {previews.length > 0 && (
                  <section>
                    <h2 className="font-bold mb-3">Attached Preview</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {previews.map((src, i) => (
                        <ImagePreview key={i} src={src} />
                      ))}
                    </div>
                  </section>
                )}

                {/* ──────────────── ⚙️ ACTION BUTTONS ──────────────── */}
                <section className="mt-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleDownloadZip}
                      className="flex-1"
                      disabled={isSubmitting}
                      variant="outline"
                    >
                      Download Updated ZIP
                    </Button>
                    <Button
                      onClick={handleSubmitOnChain}
                      disabled={!readyToSubmit || isSubmitting}
                      className="flex-1"
                    >
                      {isSubmitting ? "Submitting..." : "Submit On-Chain"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleClearUpload}
                      disabled={isSubmitting}
                    >
                      Clear
                    </Button>
                  </div>
                </section>
              </div>

              {status && (
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {status}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}

// ========================================================================
//  SUB-COMPONENTS
// ========================================================================

function ImagePreview({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="relative w-full aspect-square border rounded-xs overflow-hidden cursor-pointer group"
      >
        <Image
          src={src}
          alt="Preview"
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm font-medium">
          View
        </div>
      </div>

      <GeneralModal
        open={open}
        onOpenChange={setOpen}
        disablePadding
        size="lg"
        image={src}
      />
    </>
  );
}
