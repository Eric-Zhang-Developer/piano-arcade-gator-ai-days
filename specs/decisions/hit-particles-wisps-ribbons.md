# Hit particles: the wisps become ribbons (#1373)

**Context.** Eric, 2026-10-25: the wisps "look very provisional compared to... the particles that come out", and on the
PianiCast reference, "do you see how high that it goes for the effects?" The wisps were one point sprite each, a
sickle 30–60 px that rose 0.3–0.8 of `uRise`.

**Choice.** Each wisp is a ribbon: a run of pool slots that share one seed and one origin, each a segment that follows
the same rising, curling path a little later than the one before it, so together they trace a blade behind its head (a
blunt head, a needle tail, 80–130 px at 1080p). Each segment is a short sharp-edged stroke turned along the path; when
the head stops, the tail catches up into a comma. The numbers come from `hit-particles-wisps-reference.md`. It stays in the existing pool, spawn cap and governor: a ribbon
is just more slots per wisp, and the cap and governor count slots.

**Options not taken.** A separate ribbon mesh (a triangle strip per wisp): a second buffer and draw call outside the
pool, cap and governor, for a look the segments reach. Longer single sprites: a sprite is square, so it can't be tall
and thin and curl at once.

**How to undo.** Revert the PR; the shader's wisp branch and `hitParticleSettings.wisps` go back.
