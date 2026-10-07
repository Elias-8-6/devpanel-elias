// Escapes LIKE/ILIKE wildcards so user input is matched literally:
// searching "%" must not return the whole table.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
