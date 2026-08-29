// supabase-js's embed cardinality inference isn't always right without
// generated DB types (a many-to-one FK can come back as an object OR a
// single-item array depending on how PostgREST resolves it) -- this reads
// either shape instead of assuming one.
export function firstEmbed<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
