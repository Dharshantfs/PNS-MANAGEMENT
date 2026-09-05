// Flexible room amenity catalog (replaces the old fixed acType/washroomType/
// hasBalcony/hasGeyser/hasWifi/hasCupboard booleans). A Room just stores the
// `key`s it has in `facilities: string[]` - AC is just one checkbox among
// many here, not a required field.
export interface FacilityOption {
  key: string;
  label: string;
}

export const FACILITY_OPTIONS: FacilityOption[] = [
  { key: 'ac', label: 'AC' },
  { key: 'table', label: 'Table' },
  { key: 'tv', label: 'TV' },
  { key: 'attached_washroom', label: 'Washroom' },
  { key: 'balcony', label: 'Balcony' },
  { key: 'fridge', label: 'Fridge' },
  { key: 'almirah', label: 'Almirah' },
  { key: 'chair', label: 'Chair' },
  { key: 'food', label: 'Food' },
  { key: 'microwave', label: 'Microwave' },
  { key: 'geyser', label: 'Geyser' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'cctv', label: 'CCTV' },
  { key: 'toilet', label: 'Toilet' },
  { key: 'cooler', label: 'Cooler' },
  { key: 'water_purifier', label: 'Water Purifier' },
  { key: 'fan', label: 'Fan' },
  { key: 'exhaust_fan', label: 'Exhaust Fan' },
  { key: 'dining_table', label: 'Dining Table' },
  { key: 'stove', label: 'Stove' },
  { key: 'light', label: 'Light' },
  { key: 'curtains', label: 'Curtains' },
  { key: 'modular_kitchen', label: 'Modular Kitchen' },
  { key: 'chimney', label: 'Chimney' },
  { key: 'bed', label: 'Bed' },
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'sofa', label: 'Sofa' },
  { key: 'washing_machine', label: 'Washing Machine' },
  { key: 'wifi', label: 'Wi-Fi' },
];

export const facilityLabel = (key: string): string => FACILITY_OPTIONS.find((f) => f.key === key)?.label || key;
