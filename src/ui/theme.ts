// Centralized UI icons using single-width Unicode symbols (no emoji)
// These are chosen to render consistently across common monospace fonts.
export const icons = {
  // Section titles (prepend simple, single-width glyphs)
  trace: "◆ Trace Excerpt",     // U+25C6 black diamond
  issues: "• Tool Issues",      // U+2022 bullet
  details: "◆ Review Details",  // For left panel title

  // Status marks
  correct: "✓",                 // U+2713 check mark
  incorrect: "✗",               // U+2717 ballot x
  unknown: "?",

  // Requirement dots (safe geometric shapes)
  reqOk: "●",                   // U+25CF black circle
  reqBad: "○",                  // U+25CB white circle
};
