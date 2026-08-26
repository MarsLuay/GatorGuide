require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");
const { parseLocationPreference } = require("@/services/app/questionnaire.enums");
const { translations } = require("@/services/app/translations");

test("parseLocationPreference maps empty and falsy values to 'unknown'", () => {
  assert.deepEqual(parseLocationPreference(null), { kind: "unknown", raw: "" });
  assert.deepEqual(parseLocationPreference(undefined), { kind: "unknown", raw: "" });
  assert.deepEqual(parseLocationPreference(""), { kind: "unknown", raw: "" });
  assert.deepEqual(parseLocationPreference("   "), { kind: "unknown", raw: "" });
});

test("parseLocationPreference parses explicit standard options", () => {
  assert.deepEqual(parseLocationPreference("washington only"), {
    kind: "washington_only",
    raw: "washington only",
  });
  assert.deepEqual(parseLocationPreference("washington_only"), {
    kind: "washington_only",
    raw: "washington_only",
  });
  assert.deepEqual(parseLocationPreference("near current location"), {
    kind: "near_current_location",
    raw: "near current location",
  });
  assert.deepEqual(parseLocationPreference("near_current_location"), {
    kind: "near_current_location",
    raw: "near_current_location",
  });
  assert.deepEqual(parseLocationPreference("nearby current location"), {
    kind: "near_current_location",
    raw: "nearby current location",
  });
  assert.deepEqual(parseLocationPreference("no preference"), {
    kind: "no_preference",
    raw: "no preference",
  });
  assert.deepEqual(parseLocationPreference("no_preference"), {
    kind: "no_preference",
    raw: "no_preference",
  });
});

test("parseLocationPreference handles prefixed values", () => {
  assert.deepEqual(parseLocationPreference("state:WA"), {
    kind: "state",
    raw: "state:WA",
    state: "Washington",
  });
  assert.deepEqual(parseLocationPreference("state:California"), {
    kind: "state",
    raw: "state:California",
    state: "California",
  });
  assert.deepEqual(parseLocationPreference("state:InvalidStateName"), {
    kind: "unknown",
    raw: "state:InvalidStateName",
  });

  assert.deepEqual(parseLocationPreference("region:pacific_northwest"), {
    kind: "region",
    raw: "region:pacific_northwest",
    regionKey: "pacific_northwest",
  });
  assert.deepEqual(parseLocationPreference("region:InvalidRegion"), {
    kind: "unknown",
    raw: "region:InvalidRegion",
  });

  assert.deepEqual(parseLocationPreference("other:random place"), {
    kind: "other",
    raw: "other:random place",
    otherText: "random place",
  });
  assert.deepEqual(parseLocationPreference("other:"), {
    kind: "unknown",
    raw: "other:",
  });
});

test("parseLocationPreference handles un-prefixed values that resolve to a state or region", () => {
  assert.deepEqual(parseLocationPreference("CA"), {
    kind: "state",
    raw: "CA",
    state: "California",
  });
  assert.deepEqual(parseLocationPreference("California"), {
    kind: "state",
    raw: "California",
    state: "California",
  });

  // Specifically Washington remaps to washington_only
  assert.deepEqual(parseLocationPreference("Washington"), {
    kind: "washington_only",
    raw: "Washington",
  });

  assert.deepEqual(parseLocationPreference("Pacific Northwest"), {
    kind: "region",
    raw: "Pacific Northwest",
    regionKey: "pacific_northwest",
  });
  assert.deepEqual(parseLocationPreference("pacific_northwest"), {
    kind: "region",
    raw: "pacific_northwest",
    regionKey: "pacific_northwest",
  });
});

test("parseLocationPreference resolves values using translation bundles", () => {
  // Using Spanish translations as a test subject if available, otherwise mock via expected behaviors
  // We can just rely on the existing imported translations.
  // Let's check Spanish "washington only" text. For safety, we pull it from the bundle.
  const esWashingtonOnly = translations.Spanish["questionnaire.locationWashingtonOnly"];
  if (esWashingtonOnly) {
    assert.deepEqual(parseLocationPreference(esWashingtonOnly, "Spanish"), {
      kind: "washington_only",
      raw: esWashingtonOnly,
    });
  }

  const esNearCurrent = translations.Spanish["questionnaire.locationNearCurrent"];
  if (esNearCurrent) {
    assert.deepEqual(parseLocationPreference(esNearCurrent, "Spanish"), {
      kind: "near_current_location",
      raw: esNearCurrent,
    });
  }

  const esNoPreference = translations.Spanish["questionnaire.noPreference"];
  if (esNoPreference) {
    assert.deepEqual(parseLocationPreference(esNoPreference, "Spanish"), {
      kind: "no_preference",
      raw: esNoPreference,
    });
  }
});

test("parseLocationPreference falls back to 'other' for unrecognized strings", () => {
  assert.deepEqual(parseLocationPreference("random unstructured text"), {
    kind: "other",
    raw: "random unstructured text",
    otherText: "random unstructured text",
  });
});
