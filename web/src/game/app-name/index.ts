// The product's name on screen (#669, specs/context/naming.md): every title, wordmark and card reads this one constant.
// "Étude" with the accent on screen; "etude" only in URLs, handles and file names. Its own folder rather than
// ui-tokens: it's copy, not a color or a size, and server metadata imports it without pulling in canvas tokens.
// Not renamed: sheet-xml's MusicXML <software> line, which no screen shows and nothing downloads.
export const APP_NAME = "Étude";
