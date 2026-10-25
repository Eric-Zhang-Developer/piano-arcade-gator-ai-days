/**
 * Every number the mastery engine uses. None is calibrated: they are rough, standard knowledge-tracing values, kept in
 * one place so they can be tuned together.
 */

/** The belief a node starts from before any evidence or diagnostic nudge. */
export const DEFAULT_PRIOR = 0.1;

/** A playing attempt counts as evidence when help was on for at most this share of it (at least 70% cold). */
export const MAX_HELP_SHARE = 0.3;

/** Chance of a right answer without knowing the node. A theory item's guess is 1 / its number of choices. */
export const PLAYING_GUESS = 0.05;
/** Chance of a wrong answer while knowing the node, in the encoding phase. */
export const THEORY_SLIP = 0.1;
export const PLAYING_SLIP = 0.15;
/**
 * The slip in the retrieval phase, for both kinds. A node only reaches retrieval after repeated cold successes, so a
 * cold failure there says far more than it would while encoding: with this slip and the ceiling below, one failure
 * keeps a mastered node above the demotion line and two in a row take it under (for any item with up to two choices).
 */
export const RETRIEVAL_SLIP = 0.03;
/** Chance of learning the node from one counting attempt in the encoding phase. */
export const LEARN = 0.1;

/** The belief never goes above this, so a long run of successes can't make a later failure meaningless. */
export const BELIEF_CEILING = 0.99;

/** Encoding moves to retrieval at this belief, with enough counting evidence. */
export const PROMOTE_AT = 0.95;
export const PROMOTE_MIN_COUNTED = 3;
export const PROMOTE_MIN_ITEMS = 2;
/** The belief a node starts retrieval with. */
export const PROMOTED_BELIEF = 0.99;
/** Retrieval goes back to encoding below this belief. */
export const DEMOTE_BELOW = 0.6;

/** Days to the next cold check: out a step on each cold success, back to the first on a failure. */
export const CHECK_DAYS = [1, 3, 7, 21, 60] as const;

/** A diagnostic answer pulls an untouched linked node's prior toward these. */
export const NUDGE_TARGET_SUCCESS = 0.8;
export const NUDGE_TARGET_FAILURE = 0.02;
/** The share of the way to the target one unit of edge weight moves a prior: weight 5 goes halfway. */
export const NUDGE_PER_WEIGHT = 0.1;
