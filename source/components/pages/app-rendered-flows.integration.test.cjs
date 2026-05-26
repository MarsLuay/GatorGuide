const assert = require("node:assert/strict");
const test = require("node:test");

const {
  React,
  act,
  changeTextByPlaceholder,
  createSpy,
  getRouter,
  hasText,
  pressByAccessibilityLabel,
  pressByText,
  render,
  resetReactNativeTestState,
  setAppData,
  setBackHandler,
  setLocalSearchParams,
  setOpportunities,
  setTranslations,
  unmount,
} = require("../../scripts/qa/react-native-test-utils.cjs");

const { ROUTES } = require("@/constants/routes");
const { QUESTIONNAIRE_FIELD_IDS } = require("@/constants/schema");
const AuthPage = require("@/components/pages/AuthPage").default;
const DeadlineCalendarPage = require("@/components/pages/DeadlineCalendarPage").default;
const HomePage = require("@/components/pages/HomePage").default;
const QuestionnairePage = require("@/components/pages/QuestionnairePage").default;
const SettingsPage = require("@/components/pages/SettingsPage").default;
const TransferEquivalencyCatalogPage =
  require("@/components/pages/TransferEquivalencyCatalogPage").default;

const defaultNotificationPreferences = {
  collegeDeadlines: false,
  generalDeadlines: false,
  internships: false,
  scholarships: false,
  transferDeadlines: false,
};

function applyFlowTranslations() {
  setTranslations({
    "auth.createAccount": "Create account",
    "auth.continueAsGuest": "Continue as guest",
    "auth.continueWithGoogle": "Continue with Google",
    "auth.continueWithMicrosoft": "Continue with Microsoft",
    "auth.defaultUser": "Student",
    "auth.email": "Email",
    "auth.emailInvalid": "Enter a valid email.",
    "auth.logIn": "Log in",
    "auth.name": "Name",
    "auth.or": "or",
    "auth.password": "Password",
    "auth.passwordMinimum": "Use at least 6 characters.",
    "auth.passwordMinimumShort": "Use 6+ characters.",
    "auth.pleaseEnterName": "Enter your name.",
    "auth.signUp": "Sign up",
    "deadlineCalendar.actionOpenCollege": "Open college",
    "deadlineCalendar.actionOpenLink": "Open link",
    "deadlineCalendar.actionShownHere": "Shown here",
    "deadlineCalendar.actionViewOpportunity": "View opportunity",
    "deadlineCalendar.activeDatesThisMonth": "{{count}} {{noun}} this month",
    "deadlineCalendar.datePlural": "dates",
    "deadlineCalendar.dateSingular": "date",
    "deadlineCalendar.done": "Done",
    "deadlineCalendar.itemPlural": "items",
    "deadlineCalendar.itemSingular": "item",
    "deadlineCalendar.kindCollegeDeadline": "College deadline",
    "deadlineCalendar.kindGeneralDeadline": "Deadline",
    "deadlineCalendar.kindOpportunity": "Opportunity",
    "deadlineCalendar.kindQuarterEnd": "Quarter end",
    "deadlineCalendar.kindQuarterStart": "Quarter start",
    "deadlineCalendar.kindRoadmapTask": "Roadmap",
    "deadlineCalendar.kindScholarship": "Scholarship",
    "deadlineCalendar.loadingMessage": "Loading deadlines.",
    "deadlineCalendar.loadingTitle": "Loading calendar",
    "deadlineCalendar.noDatedItemsMessage": "No dated items yet.",
    "deadlineCalendar.noDatedItemsTitle": "No deadlines",
    "deadlineCalendar.noItemsThisMonthMessage": "Try another month.",
    "deadlineCalendar.noItemsThisMonthTitle": "No items this month",
    "deadlineCalendar.roadmapPlanningApplications": "Applications",
    "deadlineCalendar.selectDateToRevealMessage": "Pick a date.",
    "deadlineCalendar.selectDateToRevealTitle": "Select a date",
    "deadlineCalendar.showAllDates": "Show all dates",
    "deadlineCalendar.sourcePlanner": "Planner",
    "deadlineCalendar.subtitle": "Deadlines from your plan and opportunities.",
    "deadlineCalendar.tapHint": "Tap a deadline for details.",
    "deadlineCalendar.title": "Deadline calendar",
    "deadlineCalendar.totalItems": "{{count}} total",
    "deadlineCalendar.upcomingDeadlines": "Upcoming deadlines",
    "general.back": "Back",
    "general.close": "Close",
    "general.error": "Error",
    "general.loading": "Loading",
    "general.pleaseWait": "Please wait",
    "home.comingSoon": "Coming soon",
    "home.createAccount": "Create account",
    "home.deadlineKindCollege": "College",
    "home.deadlineKindInternship": "Internship",
    "home.deadlineKindScholarship": "Scholarship",
    "home.deadlineKindSchool": "School",
    "home.markDeadlineDone": "Mark done",
    "home.markDeadlineUnfinished": "Mark unfinished",
    "home.openAction": "Open",
    "home.signUp": "Sign up",
    "home.signUpMessage": "Create an account to sync your plan across devices.",
    "home.student": "student",
    "home.upcomingDeadlinesDescription": "Keep the next important dates close.",
    "home.welcomeBack": "Welcome back, {{name}}",
    "navigation.home": "Home",
    "navigation.profile": "Profile",
    "navigation.resources": "Resources",
    "navigation.settings": "Settings",
    "profile.prepareDataError": "We could not prepare your data.",
    "questionnaire.complete": "Complete",
    "questionnaire.costOfAttendance": "Cost of attendance",
    "questionnaire.gpa": "GPA",
    "questionnaire.gpaPlaceholder": "3.75",
    "questionnaire.inState": "In state",
    "questionnaire.inStateOutOfState": "Residency",
    "questionnaire.lgbtqCommunity": "LGBTQ community",
    "questionnaire.major": "Major",
    "questionnaire.majorPlaceholder": "Computer science",
    "questionnaire.modeBasic": "Matching essentials",
    "questionnaire.modeBasicDescription": "Answer the high-impact matching questions.",
    "questionnaire.modeFull": "Everything",
    "questionnaire.modeFullDescription": "Answer every preference question.",
    "questionnaire.needFinancialAid": "Need financial aid",
    "questionnaire.next": "Next",
    "questionnaire.no": "No",
    "questionnaire.noPreference": "No preference",
    "questionnaire.outOfState": "Out of state",
    "questionnaire.preferNotToSay": "Prefer not to say",
    "questionnaire.saveAndExit": "Save and exit",
    "questionnaire.sectionDataWeNeed": "Data we need",
    "questionnaire.stepOf": "Step {{step}} of {{total}}",
    "questionnaire.title": "Questionnaire",
    "questionnaire.under20k": "Under $20k",
    "questionnaire.yes": "Yes",
    "settings.about": "About",
    "settings.allNotifications": "All notifications",
    "settings.automaticNotifications": "Automatic notifications",
    "settings.dark": "Dark",
    "settings.data": "Data",
    "settings.desktopIntro": "Manage your app preferences.",
    "settings.export": "Export",
    "settings.import": "Import",
    "settings.language": "Language",
    "settings.light": "Light",
    "settings.noNotifications": "No notifications",
    "settings.notificationTypeCollegeDeadlines": "College deadlines",
    "settings.notificationTypeGeneralDeadlines": "General deadlines",
    "settings.notificationTypeInternships": "Internships",
    "settings.notificationTypeScholarships": "Scholarships",
    "settings.notificationTypeTransferDeadlines": "Transfer deadlines",
    "settings.notifications": "Notifications",
    "settings.privacyPolicy": "Privacy policy",
    "settings.selectedNotificationsCount": "{{count}} selected",
    "settings.send": "Send",
    "settings.sending": "Sending",
    "settings.settings": "Settings",
    "settings.support": "Support",
    "settings.supportComposerPlaceholder": "Tell us what happened",
    "settings.supportComposerSubtitle": "Send a note to the GatorGuide team.",
    "settings.supportEmailSubject": "GatorGuide support",
    "settings.system": "System",
    "settings.theme": "Theme",
    "transferEquivalencies.campus": "Campus",
    "transferEquivalencies.campusHelperUw": "Choose a UW campus.",
    "transferEquivalencies.categoryPlural": "categories",
    "transferEquivalencies.categoryResults": "Category results",
    "transferEquivalencies.categoryResultsCount": "{{count}} {{noun}}",
    "transferEquivalencies.categorySingular": "category",
    "transferEquivalencies.clearSearch": "Clear search",
    "transferEquivalencies.college": "College",
    "transferEquivalencies.collegeHelper": "Pick the catalog source.",
    "transferEquivalencies.equivalencyPlural": "equivalencies",
    "transferEquivalencies.equivalencySingular": "equivalency",
    "transferEquivalencies.filteredRowCount": "{{count}} of {{total}} {{noun}}",
    "transferEquivalencies.greenRiverCollege": "Green River College",
    "transferEquivalencies.grcDescription": "Green River general education.",
    "transferEquivalencies.noMatchesBody": "Try a different course or category.",
    "transferEquivalencies.noMatchesTitle": "No matching equivalencies",
    "transferEquivalencies.noTaggedBody": "No tagged equivalencies are available.",
    "transferEquivalencies.noTaggedTitle": "No categories available",
    "transferEquivalencies.pageDescriptionUw": "Browse {{campus}} categories.",
    "transferEquivalencies.rowCount": "{{count}} {{noun}}",
    "transferEquivalencies.searchHelperUw": "Search by source course, title, or outcome.",
    "transferEquivalencies.searchPlaceholder": "Search courses",
    "transferEquivalencies.searchTitle": "Search",
    "transferEquivalencies.showing": "Showing",
    "transferEquivalencies.title": "Transfer equivalencies",
    "transferEquivalencies.universityOfWashington": "University of Washington",
    "transferEquivalencies.uwDescription": "UW transfer equivalencies.",
  });
}

function createUser(overrides = {}) {
  return {
    email: "riley@example.edu",
    hasSeenOnboarding: true,
    isGuest: false,
    major: "Computer science",
    name: "Riley Student",
    uid: "user-1",
    ...overrides,
  };
}

function createAppData({ state = {}, user = createUser(), methods = {} } = {}) {
  return {
    isHydrated: true,
    state: {
      notificationPreferences: { ...defaultNotificationPreferences },
      notificationsEnabled: true,
      questionnaireAnswers: {},
      savedColleges: [],
      user,
      ...state,
    },
    deleteAccount: createSpy(async () => undefined),
    patchUserLocally: createSpy(async () => undefined),
    restoreData: createSpy(async () => undefined),
    setNotificationPreferences: createSpy(async () => undefined),
    setNotificationsEnabled: createSpy(async () => undefined),
    setOnboardingSeen: createSpy(async () => undefined),
    setQuestionnaireAnswers: createSpy(async () => undefined),
    signIn: createSpy(async () => undefined),
    signInAsGuest: createSpy(async () => undefined),
    signInWithAuthUser: createSpy(async () => undefined),
    signOut: createSpy(async () => undefined),
    updateUser: createSpy(async () => undefined),
    ...methods,
  };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

test("QuestionnairePage renders the basic matching flow and saves a draft", async () => {
  resetReactNativeTestState();
  applyFlowTranslations();
  const back = createSpy();
  const appData = createAppData({
    state: {
      questionnaireAnswers: {},
    },
  });
  setBackHandler(back);
  setAppData(appData);

  const renderer = render(React.createElement(QuestionnairePage));

  assert.equal(hasText(renderer, "Matching essentials"), true);
  assert.equal(hasText(renderer, "Everything"), true);

  pressByText(renderer, "Next");
  assert.equal(hasText(renderer, "GPA"), true);

  changeTextByPlaceholder(renderer, "3.75", "3.6");
  pressByText(renderer, "Save and exit");
  await flushAsyncWork();

  assert.equal(appData.setQuestionnaireAnswers.calls.length, 1);
  assert.equal(
    appData.setQuestionnaireAnswers.calls[0][0][QUESTIONNAIRE_FIELD_IDS.gpa],
    "3.6"
  );
  assert.equal(back.calls.length, 1);

  unmount(renderer);
});

test("DeadlineCalendarPage renders opportunity deadlines and opens resources", async () => {
  resetReactNativeTestState();
  applyFlowTranslations();
  setAppData(
    createAppData({
      user: null,
    })
  );
  setOpportunities({
    matchedOpportunities: [
      {
        college: {},
        computedDueAt: null,
        dueAt: "2026-06-10T17:00:00.000Z",
        externalUrl: "",
        isDone: false,
        opportunityId: "promise-scholarship",
        organizationName: "GatorGuide Foundation",
        summary: "Apply for the Promise Scholarship.",
        title: "Promise Scholarship",
        type: "scholarship",
      },
    ],
  });

  const renderer = render(React.createElement(DeadlineCalendarPage));
  await flushAsyncWork();

  assert.equal(hasText(renderer, "Promise Scholarship"), true);
  pressByText(renderer, "Promise Scholarship");
  assert.deepEqual(getRouter().push.calls.at(-1), [ROUTES.tabsResources]);

  unmount(renderer);
});

test("TransferEquivalencyCatalogPage filters visible catalog rows and clears search", () => {
  resetReactNativeTestState();
  applyFlowTranslations();
  setLocalSearchParams({
    campusId: "uw-seattle",
  });
  setAppData(createAppData({ user: null }));

  const renderer = render(React.createElement(TransferEquivalencyCatalogPage));

  assert.equal(hasText(renderer, "Transfer equivalencies"), true);
  assert.equal(hasText(renderer, "Category results"), true);

  changeTextByPlaceholder(renderer, "Search courses", "BIOL");
  assert.equal(hasText(renderer, "BIOL 100"), true);

  changeTextByPlaceholder(renderer, "Search courses", "zzzz-no-course");
  assert.equal(hasText(renderer, "No matching equivalencies"), true);

  pressByAccessibilityLabel(renderer, "Clear search");
  assert.equal(hasText(renderer, "Category results"), true);

  unmount(renderer);
});

test("HomePage renders the guest account CTA and routes to auth", async () => {
  resetReactNativeTestState();
  applyFlowTranslations();
  setAppData(
    createAppData({
      user: createUser({
        isGuest: true,
        uid: "guest-1",
      }),
    })
  );

  const renderer = render(React.createElement(HomePage));
  await flushAsyncWork();

  assert.equal(hasText(renderer, "Create account"), true);
  assert.equal(hasText(renderer, "Create an account to sync your plan across devices."), true);

  pressByText(renderer, "Sign up");
  assert.deepEqual(getRouter().push.calls.at(-1), [ROUTES.login]);

  unmount(renderer);
});

test("AuthPage submits an email sign-up and supports guest entry", async () => {
  resetReactNativeTestState();
  applyFlowTranslations();
  const appData = createAppData({
    user: null,
  });
  setAppData(appData);

  const renderer = render(React.createElement(AuthPage));

  changeTextByPlaceholder(renderer, "Name", "Riley");
  changeTextByPlaceholder(renderer, "Email", "riley@example.edu");
  changeTextByPlaceholder(renderer, "Password", "secret1");
  pressByText(renderer, "Create account");
  await flushAsyncWork();

  assert.deepEqual(appData.signIn.calls[0], [
    {
      email: "riley@example.edu",
      isSignUp: true,
      name: "Riley",
      password: "secret1",
    },
  ]);

  pressByText(renderer, "Continue as guest");
  await flushAsyncWork();
  assert.equal(appData.signInAsGuest.calls.length, 1);

  unmount(renderer);
});

test("SettingsPage opens support and notification preference dialogs", async () => {
  resetReactNativeTestState();
  applyFlowTranslations();
  const appData = createAppData();
  setAppData(appData);

  const renderer = render(React.createElement(SettingsPage));
  await flushAsyncWork();

  assert.equal(hasText(renderer, "Transfer deadlines"), false);

  pressByText(renderer, "Automatic notifications");
  assert.equal(hasText(renderer, "Transfer deadlines"), true);
  pressByAccessibilityLabel(renderer, "Transfer deadlines");
  assert.deepEqual(appData.setNotificationPreferences.calls[0], [
    {
      transferDeadlines: true,
    },
  ]);

  pressByText(renderer, "Close");
  pressByText(renderer, "Support");
  assert.equal(hasText(renderer, "Send a note to the GatorGuide team."), true);
  assert.equal(hasText(renderer, "Tell us what happened"), false);
  changeTextByPlaceholder(renderer, "Tell us what happened", "I need help with deadlines.");

  unmount(renderer);
});
