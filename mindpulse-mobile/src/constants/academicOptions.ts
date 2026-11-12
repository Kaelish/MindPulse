/**
 * Year / academic level choices shared by the Health Background wizard and
 * the Account Information editor, so both screens always offer the same list.
 *
 * `profiles.year_level` is a free-text column with no check constraint, so
 * these labels need no schema change — but renaming a label (the 0033
 * migration turned "Faculty / Staff" into "Employed") must be paired with a
 * data update for rows that already stored the old label.
 */
export const YEAR_LEVEL_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Graduate / Postgrad',
  'Employed',
  'Prefer not to say',
] as const;
