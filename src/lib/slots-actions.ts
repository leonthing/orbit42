"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/slots 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/slots";

export async function addAvailability(...args: Parameters<typeof impl.addAvailability>) {
  return impl.addAvailability(...args);
}

export async function archiveSlot(...args: Parameters<typeof impl.archiveSlot>) {
  return impl.archiveSlot(...args);
}

export async function bookSlot(...args: Parameters<typeof impl.bookSlot>) {
  return impl.bookSlot(...args);
}

export async function cancelMyBooking(...args: Parameters<typeof impl.cancelMyBooking>) {
  return impl.cancelMyBooking(...args);
}

export async function changeMyBookingListState(...args: Parameters<typeof impl.changeMyBookingListState>) {
  return impl.changeMyBookingListState(...args);
}

export async function cloneSlot(...args: Parameters<typeof impl.cloneSlot>) {
  return impl.cloneSlot(...args);
}

export async function countSlotBookings(...args: Parameters<typeof impl.countSlotBookings>) {
  return impl.countSlotBookings(...args);
}

export async function createSlot(...args: Parameters<typeof impl.createSlot>) {
  return impl.createSlot(...args);
}

export async function createSlotFromPreset(...args: Parameters<typeof impl.createSlotFromPreset>) {
  return impl.createSlotFromPreset(...args);
}

export async function deleteSlot(...args: Parameters<typeof impl.deleteSlot>) {
  return impl.deleteSlot(...args);
}

export async function proposeRescheduleAsGuest(...args: Parameters<typeof impl.proposeRescheduleAsGuest>) {
  return impl.proposeRescheduleAsGuest(...args);
}

export async function proposeRescheduleAsHost(...args: Parameters<typeof impl.proposeRescheduleAsHost>) {
  return impl.proposeRescheduleAsHost(...args);
}

export async function refreshBookableOptions(...args: Parameters<typeof impl.refreshBookableOptions>) {
  return impl.refreshBookableOptions(...args);
}

export async function removeAvailability(...args: Parameters<typeof impl.removeAvailability>) {
  return impl.removeAvailability(...args);
}

export async function rescheduleMyBooking(...args: Parameters<typeof impl.rescheduleMyBooking>) {
  return impl.rescheduleMyBooking(...args);
}

export async function respondToReschedule(...args: Parameters<typeof impl.respondToReschedule>) {
  return impl.respondToReschedule(...args);
}

export async function updateBookingStatus(...args: Parameters<typeof impl.updateBookingStatus>) {
  return impl.updateBookingStatus(...args);
}

export async function updateSlot(...args: Parameters<typeof impl.updateSlot>) {
  return impl.updateSlot(...args);
}

export async function withdrawReschedule(...args: Parameters<typeof impl.withdrawReschedule>) {
  return impl.withdrawReschedule(...args);
}
