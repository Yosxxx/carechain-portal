// -------------------- Attachment Helpers --------------------

/**
 * Determines which records have attachments based on file size.
 * @param records - Array of record objects with at least `pda` and `sizeBytes` fields.
 * @param threshold - Minimum size (in bytes) to consider an attachment as present. Default: 5120 bytes.
 * @returns Record mapping each record PDA to a boolean indicating attachment presence.
 */
export function deriveAttachmentStatus(
  records: Array<{ pda: string; sizeBytes: number }>,
  threshold = 5120
): Record<string, boolean> {
  if (!records || records.length === 0) return {};
  const status: Record<string, boolean> = {};
  for (const rec of records) status[rec.pda] = rec.sizeBytes > threshold;
  return status;
}
