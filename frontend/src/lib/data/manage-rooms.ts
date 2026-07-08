import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";
import { rooms as sampleRooms, reservations as sampleReservations, type RoomStatus } from "@/lib/mock";
import { getRoomType } from "@/lib/cms";

export type { RoomStatus };

export interface ReservationSummary {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  isVip: boolean;
  roomAssigned: boolean;
}

export interface ManageRoom {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeSlug: string;
  roomTypeName: string;
  status: RoomStatus;
  physicalStatus?: RoomStatus;
  currentReservation?: ReservationSummary | null;
  upcomingReservation?: ReservationSummary | null;
}

interface ApiRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  physicalStatus?: RoomStatus;
  roomType?: { name: string; slug: string } | null;
  currentReservation?: ReservationSummary | null;
  upcomingReservation?: ReservationSummary | null;
}

const toRoom = (r: ApiRoom): ManageRoom => ({
  id: r.id,
  roomNumber: r.roomNumber,
  floor: r.floor,
  roomTypeSlug: r.roomType?.slug ?? "",
  roomTypeName: r.roomType?.name ?? "—",
  status: r.status,
  physicalStatus: r.physicalStatus,
  currentReservation: r.currentReservation ?? null,
  upcomingReservation: r.upcomingReservation ?? null,
});

export async function listRooms(): Promise<ManageRoom[]> {
  if (!hasApi()) {
    const today = new Date().toISOString().slice(0, 10);
    return sampleRooms.map((r) => {
      const checkedIn = sampleReservations.find(
        (res) => res.roomNumber === r.roomNumber && res.status === "CHECKED_IN",
      );
      const upcoming = sampleReservations.find(
        (res) =>
          res.roomTypeSlug === r.roomTypeSlug &&
          res.status === "CONFIRMED" &&
          res.checkInDate >= today,
      );
      const toSummary = (res: typeof checkedIn): ReservationSummary | null =>
        res
          ? {
              id: res.id,
              reservationNumber: res.reservationNumber,
              guestName: res.guestName,
              guestPhone: res.guestPhone,
              checkInDate: res.checkInDate,
              checkOutDate: res.checkOutDate,
              isVip: res.isVip ?? false,
              roomAssigned: !!res.roomNumber,
            }
          : null;
      const effectiveStatus: RoomStatus =
        r.status === "AVAILABLE" && upcoming?.checkInDate === today ? "RESERVED" : r.status;
      return {
        ...r,
        roomTypeName: getRoomType(r.roomTypeSlug)?.name ?? "—",
        status: effectiveStatus,
        physicalStatus: r.status,
        currentReservation: toSummary(checkedIn),
        upcomingReservation: toSummary(upcoming),
      };
    });
  }
  const { data } = await apiRequest<ApiRoom[]>("/rooms");
  return data.map(toRoom);
}

export async function updateRoomStatus(id: string, status: RoomStatus): Promise<void> {
  await apiRequest(`/rooms/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export interface ArrivalSummary {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  isVip: boolean;
}

export interface RoomDetail {
  room: { id: string; roomNumber: string; floor: number; status: RoomStatus; roomType: string | null };
  occupant: {
    name: string;
    phone: string;
    isVip: boolean;
    reservationId: string;
    reservationNumber: string;
    checkInDate: string;
    checkOutDate: string;
  } | null;
  assignedUpcoming: ArrivalSummary[];
  unassignedArrivals: ArrivalSummary[];
  assignedHousekeeper: string | null;
  housekeeping: { id: string; type: string; status: string; priority: string; assignedTo: string | null }[];
  assets: { id: string; assetNumber: string; name: string; status: string }[];
  maintenanceIssues: { id: string; workOrderNumber: string; asset: string; priority: string; status: string }[];
}

/** Mock room detail for offline/demo mode. */
function mockRoomDetail(id: string): RoomDetail {
  const r = sampleRooms.find((rm) => rm.id === id) ?? sampleRooms[0];
  const today = new Date().toISOString().slice(0, 10);
  const checkedIn = sampleReservations.find((res) => res.roomNumber === r.roomNumber && res.status === "CHECKED_IN");
  const assigned = sampleReservations.filter(
    (res) => res.roomNumber === r.roomNumber && res.status === "CONFIRMED" && res.checkInDate >= today,
  );
  const unassigned = sampleReservations.filter(
    (res) => !res.roomNumber && res.roomTypeSlug === r.roomTypeSlug && res.status === "CONFIRMED" && res.checkInDate >= today,
  );
  const toArrival = (res: (typeof sampleReservations)[0]): ArrivalSummary => ({
    id: res.id,
    reservationNumber: res.reservationNumber,
    guestName: res.guestName,
    guestPhone: res.guestPhone,
    checkInDate: res.checkInDate,
    checkOutDate: res.checkOutDate,
    isVip: res.isVip ?? false,
  });
  return {
    room: { id: r.id, roomNumber: r.roomNumber, floor: r.floor, status: r.status, roomType: getRoomType(r.roomTypeSlug)?.name ?? null },
    occupant: checkedIn
      ? {
          name: checkedIn.guestName,
          phone: checkedIn.guestPhone,
          isVip: checkedIn.isVip ?? false,
          reservationId: checkedIn.id,
          reservationNumber: checkedIn.reservationNumber,
          checkInDate: checkedIn.checkInDate,
          checkOutDate: checkedIn.checkOutDate,
        }
      : null,
    assignedUpcoming: assigned.map(toArrival),
    unassignedArrivals: unassigned.map(toArrival),
    assignedHousekeeper: null,
    housekeeping: [],
    assets: [],
    maintenanceIssues: [],
  };
}

export async function getRoomDetail(id: string): Promise<RoomDetail> {
  if (!hasApi()) return mockRoomDetail(id);
  const { data } = await apiRequest<RoomDetail>(`/rooms/${id}/detail`);
  return data;
}
