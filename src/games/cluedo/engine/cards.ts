/** The classic Cluedo card sets. Card names are unique across categories, so a
 * plain string identifies both the card and (via lookup) its category. */

export const SUSPECTS = [
  'Miss Scarlett',
  'Colonel Mustard',
  'Mrs White',
  'Mr Green',
  'Mrs Peacock',
  'Professor Plum',
] as const;

export const WEAPONS = [
  'Candlestick',
  'Dagger',
  'Lead Pipe',
  'Revolver',
  'Rope',
  'Spanner',
] as const;

export const ROOMS = [
  'Kitchen',
  'Ballroom',
  'Conservatory',
  'Dining Room',
  'Billiard Room',
  'Library',
  'Lounge',
  'Hall',
  'Study',
] as const;

export type Suspect = (typeof SUSPECTS)[number];
export type Weapon = (typeof WEAPONS)[number];
export type Room = (typeof ROOMS)[number];
export type Card = Suspect | Weapon | Room;

/** The four corner rooms are linked diagonally by secret passages. */
export const SECRET_PASSAGES: Partial<Record<Room, Room>> = {
  Kitchen: 'Study',
  Study: 'Kitchen',
  Conservatory: 'Lounge',
  Lounge: 'Conservatory',
};

/** A murder solution, or a Suggestion/Accusation naming all three. */
export interface Triple {
  suspect: Suspect;
  weapon: Weapon;
  room: Room;
}
