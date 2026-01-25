export const ErrorMessages = {
    PENDING_REQUEST: 'You already have a pending request to join a neighborhood.',
    NO_NEIGHBORHOOD_FOUND: 'No neighborhood found near your location.',
    PENDING_VOUCH: 'Please find another friendly neighbor to vouch for you.',
    NOT_AUTHORIZED_SEED: 'You are not authorized.',
    PROFILE_NOT_FOUND: 'Profile not found.',
} as const;

export type ErrorCode = keyof typeof ErrorMessages;