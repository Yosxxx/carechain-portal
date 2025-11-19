"use server";

export async function addMedicationAction(name: string): Promise<string> {
  if (!name || typeof name !== "string") throw new Error("Invalid medication");

  const cleaned = name.trim().toLowerCase();
  if (cleaned.length < 2) throw new Error("Too short");

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
