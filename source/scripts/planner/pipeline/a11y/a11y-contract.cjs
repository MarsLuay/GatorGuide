"use strict";

/**
 * P19 accessibility contract harness — static checks only.
 */

function assertReducedMotionHonored(styles = {}) {
  const motion = styles["prefers-reduced-motion"] === "reduce";
  if (!motion) return { ok: true, reason: "preference-unset" };
  const banned = ["animation:", "transition:"].filter((k) =>
    String(styles.cssText || "").includes(k)
  );
  // Allow transition:none / animation:none
  const nonessential = banned.filter((k) => {
    const text = String(styles.cssText || "");
    if (k === "animation:" && /animation:\s*none/.test(text)) return false;
    if (k === "transition:" && /transition:\s*none/.test(text)) return false;
    return true;
  });
  return { ok: nonessential.length === 0, nonessential };
}

function assertTouchTargetMin(sizePx, min = 44) {
  return { ok: Number(sizePx) >= min, sizePx, min };
}

function assertTextScaleSurvives(layout, scale = 2) {
  const lost = (layout?.actionsAt100 || []).filter(
    (a) => !(layout?.actionsAtScale || []).includes(a)
  );
  return { ok: lost.length === 0, lost, scale };
}

module.exports = {
  assertReducedMotionHonored,
  assertTouchTargetMin,
  assertTextScaleSurvives,
};
