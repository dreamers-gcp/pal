import type { RequestStatus } from "@/lib/types";

/**
 * Which approve / reject / clarify controls to show for a request at its current status.
 * Pending & clarification: all three. Approved: reject + clarify only. Rejected: approve + clarify only.
 */
export function adminRequestActionVisibility(status: RequestStatus): {
  approve: boolean;
  reject: boolean;
  clarify: boolean;
} {
  switch (status) {
    case "pending":
    case "clarification_needed":
      return { approve: true, reject: true, clarify: true };
    case "approved":
      return { approve: false, reject: true, clarify: true };
    case "rejected":
      return { approve: true, reject: false, clarify: true };
  }
}
