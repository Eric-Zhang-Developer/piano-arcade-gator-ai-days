import css from "./harmony.module.css";
import { look } from "./look";

// The key to the drawings, the same on the map and the atlas.
export function Legend() {
  return (
    <ul className={css.legend} aria-label="Key">
      <li>
        <span className={css.swatch} style={{ background: look.major }} />
        major triad
      </li>
      <li>
        <span className={css.swatch} style={{ background: look.minor }} />
        minor triad
      </li>
      <li>
        <span className={css.swatch} style={{ outline: `2px solid ${look.home}`, outlineOffset: -2 }} />
        home: the most-played triad
      </li>
      <li>brighter: played longer · thicker: taken more · dashed: wraps round</li>
      <li>P, L, R: the neo-Riemannian moves</li>
    </ul>
  );
}
