// Supabase admin đã được thay thế bằng MySQL. Stub để tránh lỗi import.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function createAdminClient() {
  const chain: any = {
    from: () => chain,
    select: () => chain,
    insert: () => Promise.resolve({ error: null }),
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  return chain;
}
export {};
