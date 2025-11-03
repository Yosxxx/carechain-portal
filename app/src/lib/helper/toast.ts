import { toast } from "sonner";

export const showLoading = (msg: string, id?: string) =>
  toast.loading(msg, id ? { id } : undefined);
export const showSuccess = (msg: string, id?: string) =>
  toast.success(msg, id ? { id } : undefined);
export const showError = (msg: string, id?: string) =>
  toast.error(msg, id ? { id } : undefined);
