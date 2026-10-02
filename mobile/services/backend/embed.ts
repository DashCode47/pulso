// PostgREST returns a many-to-one embed (classes -> instructors) as an object,
// but without generated DB types supabase-js can't tell and the code used to
// index it as an array ([0]), which silently came back undefined. Same helper
// as web/src/lib/supabaseEmbed.ts: reads either shape.
export function firstEmbed<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
