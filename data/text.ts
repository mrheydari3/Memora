/**
 * Text helpers for card content.
 *
 * Cards are manually entered, so the text direction has to be inferred from
 * the script rather than assumed: a Persian answer typed into a new card must
 * render right-to-left like the seeded cards do.
 */

const RTL_SCRIPT =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function textDirection(text: string): 'ltr' | 'rtl' {
  return RTL_SCRIPT.test(text) ? 'rtl' : 'ltr';
}
