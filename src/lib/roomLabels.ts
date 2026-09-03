import { Property } from '../types';

// Room type/sharing are now owner-configurable per property (see
// SettingsPage.tsx) rather than a fixed enum, so any UI that used to read
// `room.type` directly needs to resolve the label via the active property's
// config instead.
export const getRoomTypeLabel = (property: Property | undefined, roomTypeId: string | undefined): string =>
  property?.roomTypes.find((rt) => rt.id === roomTypeId)?.name || 'Room';

export const getSharingLabel = (property: Property | undefined, sharingId: string | undefined): string =>
  property?.sharingOptions.find((s) => s.id === sharingId)?.label || 'Sharing';

export const getSharingOccupancy = (property: Property | undefined, sharingId: string | undefined): number =>
  property?.sharingOptions.find((s) => s.id === sharingId)?.occupancy || 1;
