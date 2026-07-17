"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, LogIn, XCircle, UserX, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui";
import { Modal } from "./modal";
import { confirmReservation, cancelReservation, markNoShow, getGuestWhatsApp } from "@/lib/data/reservations";
import type { Reservation } from "@/lib/mock";

/**
 * Status-appropriate reservation actions. Destructive actions require a confirm
 * dialog (§8.1). Wired to the API (confirm / cancel) with query invalidation.
 */
export function ReservationActions({ reservation }: { reservation: Reservation }) {
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [status, setStatus] = useState(reservation.status);

  // Composes the guest's confirmation server-side and opens WhatsApp with it ready
  // to send. Business-initiated WhatsApp needs the Meta Cloud API + an approved
  // template, which isn't set up yet — so a human presses send. The message body is
  // already the real one, so connecting the API later only swaps the transport.
  const sendWhatsApp = useMutation({
    mutationFn: () => getGuestWhatsApp(reservation.id),
    onSuccess: (msg) => {
      if (!msg.link) {
        toast.error("No WhatsApp number on file for this guest.");
        return;
      }
      window.open(msg.link, "_blank", "noopener");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reservation", reservation.id] });
    qc.invalidateQueries({ queryKey: ["reservations"] });
  };

  const confirm = useMutation({
    mutationFn: () => confirmReservation(reservation.id),
    onSuccess: () => { setStatus("CONFIRMED"); toast.success("Reservation confirmed."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelReservation(reservation.id),
    onSuccess: () => { setStatus("CANCELLED"); setConfirmCancel(false); toast.success("Reservation cancelled."); invalidate(); },
    onError: (e: Error) => { toast.error(e.message); setConfirmCancel(false); },
  });

  const noShow = useMutation({
    mutationFn: () => markNoShow(reservation.id),
    onSuccess: () => { setStatus("NO_SHOW"); setConfirmNoShow(false); toast.success("Marked as no-show."); invalidate(); },
    onError: (e: Error) => { toast.error(e.message); setConfirmNoShow(false); },
  });

  if (status === "CANCELLED" || status === "CHECKED_OUT" || status === "NO_SHOW") {
    return <p className="text-sm text-fg-muted">No actions available for a {status.replace(/_/g, " ").toLowerCase()} reservation.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Available in every live state — the desk re-sends details on request. */}
      <Button variant="outline" onClick={() => sendWhatsApp.mutate()} disabled={sendWhatsApp.isPending}>
        {sendWhatsApp.isPending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
        WhatsApp guest
      </Button>
      {status === "PENDING" && (
        <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
          {confirm.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Confirm
        </Button>
      )}
      {status === "CONFIRMED" && (
        <Button href="/manage/reception">
          <LogIn size={16} /> Check in
        </Button>
      )}
      {/* Guest never arrived — free the room without a cancellation. */}
      {(status === "CONFIRMED" || status === "PENDING") && (
        <Button variant="outline" onClick={() => setConfirmNoShow(true)}>
          <UserX size={16} /> No-show
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
          <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            {cancel.isPending && <Loader2 size={16} className="animate-spin" />} Cancel Reservation
          </Button>
        </div>
      </Modal>

      <Modal open={confirmNoShow} onClose={() => setConfirmNoShow(false)} title="Mark as no-show?" description="Use this when the guest never arrived. It frees the room and is logged; it can't be checked in afterwards.">
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmNoShow(false)}>Back</Button>
          <Button variant="destructive" disabled={noShow.isPending} onClick={() => noShow.mutate()}>
            {noShow.isPending && <Loader2 size={16} className="animate-spin" />} Confirm No-show
          </Button>
        </div>
      </Modal>
    </div>
  );
}
