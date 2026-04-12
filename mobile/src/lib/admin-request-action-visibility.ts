import type { RequestStatus } from "../types";

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
