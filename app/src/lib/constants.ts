// -------------------- PINATA CONFIG --------------------
export const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud";

// Normalize and return proper IPFS gateway URL
export const IPFS_GATEWAY = (cid: string): string => {
  const base = PINATA_GATEWAY.startsWith("http")
    ? PINATA_GATEWAY
    : `https://${PINATA_GATEWAY}`;
  return `${base}/ipfs/${cid}`;
};

// -------------------- CONSTANTS --------------------
export const MAX_NAME_LEN = 100;
export const MAX_KMS_REF_LEN = 64;
export const MAX_DID_LEN = 128;

// -------------------- EXPLORER --------------------
export const EXPLORER = (sig: string, cluster = "devnet") =>
  `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;

// -------------------- ACCESS SCOPES --------------------
export const SCOPE_READ = 0b0001;
export const SCOPE_WRITE = 0b0010;

export const SCOPE_OPTIONS = [
  { label: "Read", bit: SCOPE_READ },
  { label: "Write", bit: SCOPE_WRITE },
];
