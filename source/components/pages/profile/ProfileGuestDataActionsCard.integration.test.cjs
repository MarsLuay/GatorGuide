const assert = require("node:assert/strict");
const test = require("node:test");

const {
  React,
  createSpy,
  getTextContents,
  pressByText,
  render,
  resetReactNativeTestState,
  unmount,
} = require("../../../scripts/qa/react-native-test-utils.cjs");

const {
  ProfileGuestDataActionsCard,
} = require("@/components/pages/profile/ProfileGuestDataActionsCard");

function t(key) {
  return {
    "profile.guestMode": "Guest mode",
    "profile.yourDataSaved": "Your data is saved on this device.",
    "settings.export": "Export",
    "settings.import": "Import",
  }[key] ?? key;
}

test("ProfileGuestDataActionsCard renders guest data actions and dispatches import/export presses", () => {
  resetReactNativeTestState();
  const onImport = createSpy();
  const onExport = createSpy();

  const renderer = render(
    React.createElement(ProfileGuestDataActionsCard, {
      cardBgClass: "bg-white",
      frameStyle: undefined,
      isDark: false,
      isGreen: false,
      isLight: true,
      onExport,
      onImport,
      secondaryTextClass: "text-slate-600",
      stackActions: false,
      t,
      textClass: "text-slate-950",
      variant: "default",
    })
  );

  const renderedText = getTextContents(renderer).join("\n");
  assert.match(renderedText, /Guest mode/);
  assert.match(renderedText, /Your data is saved on this device\./);
  assert.match(renderedText, /Import/);
  assert.match(renderedText, /Export/);

  pressByText(renderer, "Import");
  pressByText(renderer, "Export");

  assert.equal(onImport.calls.length, 1);
  assert.equal(onExport.calls.length, 1);

  unmount(renderer);
});
