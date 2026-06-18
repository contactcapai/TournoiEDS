// cn — concatène des classes en ignorant les valeurs falsy (false/null/undefined).
// Évite la duplication du pattern `[...].filter(Boolean).join(" ")` dans les primitives.
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
