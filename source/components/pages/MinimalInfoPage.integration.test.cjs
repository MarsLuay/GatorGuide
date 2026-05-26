const assert = require("node:assert/strict");
const test = require("node:test");

const {
  React,
  createSpy,
  getTextContents,
  pressByText,
  render,
  resetReactNativeTestState,
  setBackHandler,
  setWindowDimensions,
  testState,
  unmount,
} = require("../../scripts/qa/react-native-test-utils.cjs");

const { SUPPORT_EMAIL, SUPPORT_MAILTO } = require("@/constants/support");
const { MinimalInfoPage } = require("@/components/pages/MinimalInfoPage");

test("MinimalInfoPage renders a complete support page and wires back/contact actions", () => {
  resetReactNativeTestState();
  setWindowDimensions({
    width: 820,
  });
  const back = createSpy();
  setBackHandler(back);

  const renderer = render(
    React.createElement(MinimalInfoPage, {
      description: "A focused place for students to understand what comes next.",
      items: [
        {
          body: "Save colleges and compare requirements before you apply.",
          icon: "school",
          title: "Plan your transfer",
        },
        {
          body: "Keep deadlines visible while your profile comes together.",
          icon: "event",
          title: "Track key dates",
        },
      ],
      note: "We only need a few details to personalize recommendations.",
      title: "How GatorGuide Helps",
    })
  );

  const renderedText = getTextContents(renderer).join("\n");

  assert.match(renderedText, /How GatorGuide Helps/);
  assert.match(renderedText, /A focused place for students to understand what comes next\./);
  assert.match(renderedText, /Plan your transfer/);
  assert.match(renderedText, /Save colleges and compare requirements before you apply\./);
  assert.match(renderedText, /Track key dates/);
  assert.match(renderedText, /Keep deadlines visible while your profile comes together\./);
  assert.match(renderedText, /We only need a few details to personalize recommendations\./);
  assert.match(renderedText, new RegExp(SUPPORT_EMAIL));

  pressByText(renderer, "Contact support");
  assert.deepEqual(testState.linkingOpenURL.calls, [[SUPPORT_MAILTO]]);

  pressByText(renderer, "Back");
  assert.equal(back.calls.length, 1);

  unmount(renderer);
});
