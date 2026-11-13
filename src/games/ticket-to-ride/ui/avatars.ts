/** The 10 static avatars players can pick. Emoji → no image assets to ship. */
export const AVATARS = ['🦊', '🐻', '🐼', '🦁', '🐸', '🦉', '🐯', '🐙', '🦄', '🐵'] as const;

export const DEFAULT_AVATAR = AVATARS[0];

/** A default avatar for a seat index (used for local hotseat, which has no picker). */
export const avatarForSeat = (index: number): string => AVATARS[index % AVATARS.length];
