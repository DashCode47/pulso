// The only file features/ and app/ should import from for backend access.
// Never import '@insforge/sdk' (or any other provider's SDK) outside this
// folder -- that's what keeps a future provider swap contained to services/backend.
export { backend } from './client';
export * from './auth';
export type { AppUser } from './auth';
