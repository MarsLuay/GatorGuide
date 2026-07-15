"use strict";

/**
 * P15 intended shell contract (harness) — do not mutate routes.ts here.
 * Integration ticket P15-A owns hot route/layout files.
 */

const INTENDED_PRIMARY_TABS = Object.freeze([
  "transferPlanner",
  "resources",
  "calendar",
  "profile",
]);

const SETTINGS_UNDER_PROFILE = true;
const HOME_TAB_REMOVED = true;

function validateShellContract({ primaryTabs, settingsIsPrimaryTab, homeIsPrimaryTab }) {
  const errors = [];
  if (JSON.stringify(primaryTabs) !== JSON.stringify(INTENDED_PRIMARY_TABS)) {
    errors.push({ type: "primary-tabs", expected: INTENDED_PRIMARY_TABS, actual: primaryTabs });
  }
  if (settingsIsPrimaryTab === true) {
    errors.push({ type: "settings-must-nest-under-profile" });
  }
  if (homeIsPrimaryTab === true) {
    errors.push({ type: "home-must-be-removed" });
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  INTENDED_PRIMARY_TABS,
  SETTINGS_UNDER_PROFILE,
  HOME_TAB_REMOVED,
  validateShellContract,
};
