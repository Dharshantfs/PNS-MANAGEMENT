// Floors are stored as numbers starting at 1 (rooms, beds, tenants, notices,
// payments all keep that number - nothing in the database changes). They are
// SHOWN Indian-style, starting from the ground floor:
//   1 -> Ground Floor, 2 -> 1st Floor, 3 -> 2nd Floor, 4 -> 3rd Floor, 5 -> 4th Floor
const ordinal = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
};

// "Ground Floor", "1st Floor", ...
export function floorLabel(floor: number | string | undefined | null): string {
  const n = Math.max(1, Math.round(Number(floor) || 1));
  return n === 1 ? 'Ground Floor' : `${ordinal(n - 1)} Floor`;
}

// Every floor of a property, for menus and tabs: [1, 2, ..., totalFloors].
export const floorNumbers = (totalFloors: number | undefined) =>
  Array.from({ length: Math.max(1, Number(totalFloors) || 1) }, (_, i) => i + 1);
