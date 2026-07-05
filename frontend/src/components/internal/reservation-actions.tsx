"use client";

import { useState } from "react";
import { CheckCircle, LogIn, XCircle } from "lucide-react";
import { Button } from "./ui";
import { Modal } from "./modal";
import type { Reservation } from "@/lib/mock";

/**
 * Status-appropriate reservation actions. Destructive actions require a confirm
 * dialog (§8.1). Mutations are mocked here — wired to the API in a later phase.
 */
export function ReservationActions({ reservation }: { reservation: Reservation }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [status, setStatus] = useState(reservation.status);

  if (status === "CANCELLED" || status === "CHECKED_OUT" || status === "NO_SHOW") {
    return <p className="text-sm text-fg-muted">No actions available for a {status.replace(/_/g, " ").toLowerCase()} reservation.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && (
        <Button onClick={() => setStatus("CONFIRMED")}>
          <CheckCircle size={16} /> Confirm
        </Button>
      )}
      {status === "CONFIRMED" && (
        <Button href="/manage/reception">
          <LogIn size={16} /> Check in
        </Button>
      )}
      {/* Domain rule: a CHECKED_IN reservation cannot be cancelled. */}
      {status !== "CHECKED_IN" && (
        <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
          <XCircle size={16} /> Cancel
        </Button>
      )}

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel reservation?" description="This will release the room's availability. This action is logged.">
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep it</Button>
          <Button variant="destructive" onClick={() => { setStatus("CANCELLED"); setConfirmCancel(false); }}>
            Cancel Reservation
          </Button>
        </div>
      </Modal>

      {status !== reservation.status && (
        <span className="inline-flex items-center text-sm text-ok">Updated → {status.replace(/_/g, " ").toLowerCase()} (mock)</span>
      )}
    </div>
  );
}
