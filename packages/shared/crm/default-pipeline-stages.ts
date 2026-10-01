// Shared: the stages every business starts with, in order. The owner renames, reorders and
// adds to them later (features 12 and 14); feature 5 puts a new lead in the first.

export const DEFAULT_PIPELINE_STAGES = ["New", "Contacted", "Booked", "Done"] as const;
