import { Rec } from "@/types/Record";

export function filterRecords(
  records: Rec[],
  search: string,
  filterMode: string | null
): Rec[] {
  const filtered = records.filter((r) =>
    (r.diagnosis + r.keywords + r.description)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  switch (filterMode) {
    case "doctor":
      filtered.sort((a, b) => a.doctor_name.localeCompare(b.doctor_name));
      break;
    case "hospital":
      filtered.sort((a, b) => a.hospital_name.localeCompare(b.hospital_name));
      break;
    case "dateAsc":
      filtered.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      break;
    case "dateDesc":
      filtered.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      break;
  }

  return filtered;
}

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}
