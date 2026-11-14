import * as activities from "./activities";
import * as categories from "./categories";
import * as dayReviews from "./day-reviews";
import * as note from "./note";
import * as projects from "./projects";
import * as quickTodos from "./quick-todos";
import * as segments from "./segments";
import * as stages from "./stages";
import * as taskLinks from "./task-links";
import * as tasks from "./tasks";
import * as time from "./time";
import * as trackingSettings from "./tracking-settings";

export { StageConflict } from "./stages";
export { TaskInvariantError, CommitCapReached } from "./tasks";
export { LinkInvalid } from "./task-links";
export { elapsedMinutes } from "./time";
export { TimerConflict, SegmentOverlap } from "./segments";
export { CategoryInUse } from "./categories";

/**
 * One workspace-facing surface over the domain modules. Route handlers talk to
 * this; the modules own their own SQL and invariants.
 */
export const store = {
  ...tasks,
  ...projects,
  ...stages,
  ...note,
  ...quickTodos,
  ...time,
  ...categories,
  ...activities,
  ...segments,
  ...trackingSettings,
  ...taskLinks,
  ...dayReviews,
};
