const Module = require("node:module");
const React = require("react");

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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__DEV__ = false;

const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("react-test-renderer is deprecated")
  ) {
    return;
  }
  originalConsoleError(...args);
};

const TestRenderer = require("react-test-renderer");

function createSpy(implementation) {
  const spy = (...args) => {
    spy.calls.push(args);
    return implementation?.(...args);
  };
  spy.calls = [];
  spy.reset = () => {
    spy.calls.length = 0;
  };
  return spy;
}

const defaultTranslations = {
  "general.back": "Back",
  "general.contactSupport": "Contact support",
  "general.error": "Error",
  "general.loading": "Loading",
  "general.pleaseWait": "Please wait",
  "profile.guestMode": "Guest mode",
  "profile.yourDataSaved": "Your data is saved on this device.",
  "settings.export": "Export",
  "settings.import": "Import",
  "startup.preparingData": "Preparing your data",
};

const defaultThemeStyles = {
  borderClass: "border-emerald-100",
  cardBgClass: "bg-white",
  inactiveButtonClass: "bg-white",
  placeholderColor: "#64748b",
  secondaryTextClass: "text-slate-600",
  screenBaseColor: "#f8fafc",
  screenGradientColors: ["#f8fafc", "#ecfdf5"],
  screenOverlayBottomColors: ["transparent", "transparent"],
  screenOverlayTopColors: ["transparent", "transparent"],
  statusBarStyle: "dark-content",
  textClass: "text-slate-950",
  textColor: "#0f172a",
};

const testState = {
  appData: {
    isHydrated: true,
    state: {
      user: null,
    },
  },
  appTheme: {
    isDark: false,
    isGreen: false,
    isLight: true,
    theme: "light",
    setTheme: createSpy(),
  },
  backHandler: createSpy(),
  language: "English",
  setLanguage: createSpy(),
  localSearchParams: {},
  localStorage: new Map(),
  linkingOpenURL: createSpy(async () => true),
  linkingCanOpenURL: createSpy(async () => true),
  opportunityState: {
    isHydrated: true,
    matchedOpportunities: [],
    setOpportunityDone: createSpy(async () => undefined),
  },
  router: {
    back: createSpy(),
    push: createSpy(),
    replace: createSpy(),
  },
  safeAreaInsets: {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
  themeStyles: defaultThemeStyles,
  translations: defaultTranslations,
  windowDimensions: {
    fontScale: 1,
    height: 844,
    scale: 1,
    width: 768,
  },
};

function resetReactNativeTestState() {
  platformMock.OS = "ios";
  testState.appData = {
    isHydrated: true,
    state: {
      user: null,
    },
  };
  testState.appTheme = {
    isDark: false,
    isGreen: false,
    isLight: true,
    theme: "light",
    setTheme: createSpy(),
  };
  testState.backHandler = createSpy();
  testState.language = "English";
  testState.setLanguage = createSpy();
  testState.localSearchParams = {};
  testState.localStorage = new Map();
  testState.linkingCanOpenURL.reset();
  testState.linkingOpenURL.reset();
  testState.opportunityState = {
    isHydrated: true,
    matchedOpportunities: [],
    setOpportunityDone: createSpy(async () => undefined),
  };
  testState.router.back.reset();
  testState.router.push.reset();
  testState.router.replace.reset();
  testState.safeAreaInsets = {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  };
  testState.themeStyles = defaultThemeStyles;
  testState.translations = defaultTranslations;
  testState.windowDimensions = {
    fontScale: 1,
    height: 844,
    scale: 1,
    width: 768,
  };
}

function setAppData(appData) {
  testState.appData = appData;
}

function setLocalSearchParams(params) {
  testState.localSearchParams = params ?? {};
}

function setPlatformOS(os) {
  platformMock.OS = os;
}

function setOpportunities(opportunityState) {
  testState.opportunityState = {
    ...testState.opportunityState,
    ...opportunityState,
  };
}

function setBackHandler(handler) {
  testState.backHandler = handler;
}

function setTranslations(translations) {
  testState.translations = {
    ...defaultTranslations,
    ...translations,
  };
}

function setWindowDimensions(windowDimensions) {
  testState.windowDimensions = {
    ...testState.windowDimensions,
    ...windowDimensions,
  };
}

function translate(key, params) {
  const translated = testState.translations[key] ?? key;
  if (!params) return translated;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replace(new RegExp(`{{\\s*${name}\\s*}}`, "g"), String(value)),
    translated
  );
}

function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }
  return typeof style === "object" ? style : {};
}

function MockModal({ visible, children, ...props }) {
  if (!visible) return null;
  return React.createElement("Modal", props, children);
}

const platformMock = {
  OS: "ios",
  select: (choices) => choices?.[platformMock.OS] ?? choices?.default,
};

class AnimatedValue {
  constructor(value) {
    this.value = value;
  }

  interpolate(config) {
    return {
      config,
      type: "interpolation",
      value: this.value,
    };
  }
}

const reactNativeMock = {
  ActivityIndicator: "ActivityIndicator",
  Alert: {
    alert: createSpy(),
  },
  Animated: {
    Value: AnimatedValue,
    View: "Animated.View",
    spring: () => ({
      start: (callback) => callback?.({ finished: true }),
    }),
  },
  Keyboard: {
    dismiss: createSpy(),
  },
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Image: "Image",
  Linking: {
    canOpenURL: (...args) => testState.linkingCanOpenURL(...args),
    openURL: (...args) => testState.linkingOpenURL(...args),
  },
  Modal: MockModal,
  Platform: platformMock,
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StatusBar: "StatusBar",
  StyleSheet: {
    absoluteFill: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    create: (styles) => styles,
    flatten: flattenStyle,
  },
  Text: "Text",
  TextInput: "TextInput",
  TouchableWithoutFeedback: "TouchableWithoutFeedback",
  View: "View",
  useWindowDimensions: () => testState.windowDimensions,
};

function buildIconComponent(displayName) {
  function Icon(props) {
    return React.createElement(displayName, props);
  }
  Icon.displayName = displayName;
  Icon.glyphMap = {};
  return Icon;
}

const vectorIconsMock = {
  FontAwesome: buildIconComponent("FontAwesome"),
  FontAwesome5: buildIconComponent("FontAwesome5"),
  Ionicons: buildIconComponent("Ionicons"),
  MaterialIcons: buildIconComponent("MaterialIcons"),
};

function buildSvgComponent(displayName) {
  function SvgComponent(props) {
    return React.createElement(displayName, props, props.children);
  }
  SvgComponent.displayName = displayName;
  return SvgComponent;
}

const svgMock = {
  __esModule: true,
  default: buildSvgComponent("Svg"),
  Circle: buildSvgComponent("Circle"),
  G: buildSvgComponent("G"),
  Path: buildSvgComponent("Path"),
  Rect: buildSvgComponent("Rect"),
};

const originalLoad = Module._load;
if (!globalThis.__GATOR_GUIDE_REACT_NATIVE_TEST_MOCKS__) {
  Module._load = function loadWithReactNativeTestMocks(request, parent, isMain) {
    if (request === "react-native") {
      return reactNativeMock;
    }

    if (request === "react-native-safe-area-context") {
      return {
        SafeAreaView: "SafeAreaView",
        useSafeAreaInsets: () => testState.safeAreaInsets,
      };
    }

    if (request === "expo-linear-gradient") {
      return {
        LinearGradient: "LinearGradient",
      };
    }

    if (request === "@expo/vector-icons") {
      return vectorIconsMock;
    }

    if (request === "@react-navigation/bottom-tabs") {
      return {
        useBottomTabBarHeight: () => 0,
      };
    }

    if (request === "expo-auth-session") {
      return {
        makeRedirectUri: () => "gatorguide://auth",
        ResponseType: {
          IdToken: "id_token",
        },
        useAuthRequest: () => [null, null, createSpy(async () => ({ type: "cancel" }))],
        useAutoDiscovery: () => null,
      };
    }

    if (request === "expo-blur") {
      return {
        BlurView: "BlurView",
      };
    }

    if (request === "expo-constants") {
      return {
        __esModule: true,
        default: {
          expoConfig: {},
        },
      };
    }

    if (request === "expo-document-picker") {
      return {
        getDocumentAsync: createSpy(async () => ({ canceled: true, assets: [] })),
      };
    }

    if (request === "expo-haptics") {
      return {
        ImpactFeedbackStyle: {
          Light: "light",
          Medium: "medium",
        },
        impactAsync: createSpy(async () => undefined),
      };
    }

    if (request === "expo-web-browser") {
      return {
        maybeCompleteAuthSession: createSpy(),
        openAuthSessionAsync: createSpy(async () => ({ type: "cancel" })),
      };
    }

    if (request === "react-native-svg") {
      return svgMock;
    }

    if (request === "expo-router") {
      return {
        router: testState.router,
        useLocalSearchParams: () => testState.localSearchParams,
        useRouter: () => testState.router,
      };
    }

    if (request === "@/hooks/use-app-data") {
      return {
        useAppData: () => testState.appData,
      };
    }

    if (request === "@/hooks/use-app-language") {
      return {
        useAppLanguage: () => ({
          language: testState.language,
          setLanguage: testState.setLanguage,
          t: translate,
        }),
      };
    }

    if (request === "@/hooks/use-app-theme") {
      return {
        useAppTheme: () => testState.appTheme,
      };
    }

    if (request === "@/hooks/use-data-portability-actions") {
      return {
        useDataPortabilityActions: () => ({
          handleExportData: createSpy(async () => undefined),
          handleImportData: createSpy(async () => undefined),
        }),
      };
    }

    if (request === "@/hooks/use-opportunities") {
      return {
        useOpportunities: () => testState.opportunityState,
      };
    }

    if (request === "@/hooks/use-back") {
      return () => testState.backHandler;
    }

    if (request === "@/hooks/use-responsive-layout") {
      return {
        useResponsiveLayout: () => ({
          getScrollContentPadding: () => ({
            paddingBottom: 24,
            paddingTop: 24,
          }),
        }),
      };
    }

    if (request === "@/hooks/use-theme-styles") {
      return {
        useThemeStyles: () => testState.themeStyles,
      };
    }

    if (request === "@/services/auth/auth.service") {
      return {
        authService: {
          signInWithGoogle: createSpy(async () => ({
            email: "student@example.edu",
            name: "Student",
            uid: "provider-user",
          })),
          signInWithGoogleCredential: createSpy(async () => ({
            email: "student@example.edu",
            name: "Student",
            uid: "provider-user",
          })),
          signInWithMicrosoft: createSpy(async () => ({
            email: "student@example.edu",
            name: "Student",
            uid: "provider-user",
          })),
          signInWithMicrosoftCredential: createSpy(async () => ({
            email: "student@example.edu",
            name: "Student",
            uid: "provider-user",
          })),
        },
      };
    }

    if (request === "@/services/colleges/college.service") {
      return {
        collegeService: {
          saveQuestionnaireResult: createSpy(async () => undefined),
        },
      };
    }

    if (request === "@/constants/transfer-equivalency-catalog.generated") {
      return {
        TRANSFER_EQUIVALENCY_CATALOG_CAMPUSES: [
          {
            id: "uw-seattle",
            title: "UW Seattle",
            summary: "Transfer paths for UW Seattle.",
          },
          {
            id: "uw-bothell",
            title: "UW Bothell",
            summary: "Transfer paths for UW Bothell.",
          },
        ],
        TRANSFER_EQUIVALENCY_CATALOG_ENTRIES: [
          {
            id: "test-biol-100",
            targetSchoolIds: ["uw-seattle"],
            sourceCourseLabel: "BIOL 100 (5)",
            sourceCourseTitle: "Survey of Biology",
            targetOutcome: "BIOL 1XX",
            tags: ["NSC"],
          },
          {
            id: "test-engl-101",
            targetSchoolIds: ["uw-seattle"],
            sourceCourseLabel: "ENGL 101 (5)",
            sourceCourseTitle: "English Composition",
            targetOutcome: "ENGL 131",
            tags: ["C"],
          },
        ],
      };
    }

    if (request === "@/constants/transfer-planner-source/computer-engineering-natural-science") {
      return {
        COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_HEADING:
          "Computer Engineering approved natural science",
        COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID:
          "computer-engineering-approved-natural-science",
        COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL:
          "Computer Engineering approved science",
        normalizeComputerEngineeringNaturalScienceFilterId: (value) =>
          String(value ?? "").trim().toLowerCase() ===
          "computer-engineering-approved-natural-science"
            ? "computer-engineering-approved-natural-science"
            : null,
      };
    }

    if (request === "@/constants/transfer-planner-source/course-metadata") {
      return {
        getTransferPlannerNormalizedCourseMetadataEntries: () => [],
      };
    }

    if (request === "@/constants/transfer-planner-source/student-runtime") {
      return {
        getTransferPlannerCanonicalCourse: () => null,
        getTransferPlannerStudentRuntimeMajorsForCampus: () => [],
        resolveTransferPlannerStudentRuntimeMajorPlan: (plan) => plan,
      };
    }

    if (request === "@/services/logging/error-logging.service") {
      return {
        errorLoggingService: {
          captureException: createSpy(),
          captureMessage: createSpy(),
        },
      };
    }

    if (request === "@/services/notifications/notifications.service") {
      return {
        notificationsService: {
          requestPermissions: createSpy(async () => "granted"),
          scheduleDeadlineNotifications: createSpy(async () => undefined),
        },
      };
    }

    if (request === "@/services/planning/roadmap.service") {
      const buildRoadmap = (userId = "test-user", seed = {}) => ({
        userId,
        version: 3,
        status: "in_progress",
        progress: {
          completedCount: 0,
          totalCount: 1,
          percent: 0,
          updatedAt: "2026-05-25T12:00:00.000Z",
        },
        profileSnapshot: {
          currentCourses: [],
          deadline: "",
          gpa: "",
          graduationDate: "",
          interests: [],
          major: seed.major ?? "",
          recommendedCourses: [],
          requiredCourses: [],
          targetSchools: seed.targetSchools ?? [],
        },
        sections: {
          documents: { id: "documents", title: "Documents", status: "not_started", order: 0, progress: { completedCount: 0, totalCount: 0, percent: 0, updatedAt: "2026-05-25T12:00:00.000Z" }, tasks: [] },
          courses: { id: "courses", title: "Courses", status: "not_started", order: 1, progress: { completedCount: 0, totalCount: 0, percent: 0, updatedAt: "2026-05-25T12:00:00.000Z" }, tasks: [] },
          applications: { id: "applications", title: "Applications", status: "not_started", order: 2, progress: { completedCount: 0, totalCount: 1, percent: 0, updatedAt: "2026-05-25T12:00:00.000Z" }, tasks: [
            {
              id: "application-deadline",
              type: "application",
              title: "Submit transfer application",
              description: "Finish the application packet.",
              status: "not_started",
              notes: [],
              order: 0,
              createdAt: "2026-05-25T12:00:00.000Z",
              updatedAt: "2026-05-25T12:00:00.000Z",
              completedAt: null,
              progress: { completedCount: 0, totalCount: 1, percent: 0, updatedAt: "2026-05-25T12:00:00.000Z" },
              metadata: { dueAt: "2026-06-15T09:00:00.000Z" },
            },
          ] },
          interests: { id: "interests", title: "Interests", status: "not_started", order: 3, progress: { completedCount: 0, totalCount: 0, percent: 0, updatedAt: "2026-05-25T12:00:00.000Z" }, tasks: [] },
        },
      });

      return {
        roadmapService: {
          buildRoadmapSeedInput: (input) => input,
          createInitialRoadmap: (userId, seed) => buildRoadmap(userId, seed),
          ensureUserRoadmap: createSpy(async (userId, seed) => buildRoadmap(userId, seed)),
          getUserRoadmap: createSpy(async (userId, seed) => buildRoadmap(userId, seed)),
          toggleTask: createSpy(async () => undefined),
        },
      };
    }

    if (request === "@/services/planning/transfer-planner.service") {
      return {
        auditOptionTitleFallback: () => [],
        buildEligibleTransferCategorySourceCourseCodesForPlan: () => [],
        buildTransferPlannerGrcTranscriptReadyCourseCodes: ({ candidateCourseCodes }) =>
          Array.from(candidateCourseCodes ?? []),
        canMarkSuggestedQuarterCourseCurrent: (course) =>
          course?.status !== "completed" &&
          course?.optionGroup?.isSelectionPrompt !== true &&
          ((course?.explicitCourseCodes ?? []).some((code) => String(code ?? "").trim()) ||
            /[A-Z&]{2,}\s*\d{3}/i.test(String(course?.label ?? ""))),
        extractCourseCodes: (value) => {
          const text = String(value ?? "").toUpperCase();
          const matches = text.match(/[A-Z& ]{2,}\s*\d{3}[A-Z]?/g) ?? [];
          return matches.map((match) => match.replace(/\s+/g, " ").trim());
        },
        getComputerEngineeringApprovedNaturalScienceTransferEntries: () => [],
        hasConcreteSuggestedQuarterCourse: () => false,
        isUserUnselectedRequirementOptionMarker: (value) =>
          String(value ?? "").trim().startsWith("__unselected__:"),
        isTransferPlannerGrcCourseSetTranscriptReady: () => true,
        markUserUnselectedRequirementOptionId: (optionId) =>
          String(optionId ?? "").trim() ? `__unselected__:${String(optionId).trim()}` : "",
        normalizeUserUnselectedRequirementOptionIds: (value) => {
          const values = Array.isArray(value) ? value : value == null ? [] : [value];
          return values
            .map((entry) => String(entry ?? "").trim())
            .filter((entry) => entry.startsWith("__unselected__:"))
            .map((entry) => entry.slice("__unselected__:".length).trim())
            .filter(Boolean);
        },
        parseCompletedTranscriptCourses: () => [],
        UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS: 45,
      };
    }

    if (request === "@/services/planning/transcript-reset.service") {
      return {
        resetTranscriptState: createSpy(async () => undefined),
      };
    }

    if (request === "@/services/storage/cache-manager.service") {
      return {
        cacheManagerService: {
          clearRelevantCaches: createSpy(async () => ({ clearedCount: 3 })),
          getAutoClearEnabled: createSpy(async () => false),
          setAutoClearEnabled: createSpy(async () => undefined),
        },
      };
    }

    if (request === "@/services/storage/local-storage.service") {
      return {
        localStorageService: {
          getItem: createSpy(async (key) => testState.localStorage.get(key) ?? null),
          setItem: createSpy(async (key, value) => {
            testState.localStorage.set(key, value);
          }),
          removeItem: createSpy(async (key) => {
            testState.localStorage.delete(key);
          }),
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  globalThis.__GATOR_GUIDE_REACT_NATIVE_TEST_MOCKS__ = true;
}

function render(element) {
  let renderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

function update(renderer, element) {
  TestRenderer.act(() => {
    renderer.update(element);
  });
}

function unmount(renderer) {
  TestRenderer.act(() => {
    renderer.unmount();
  });
}

function getNodeText(node) {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!node || !Array.isArray(node.children)) {
    return "";
  }

  return node.children.map(getNodeText).join("");
}

function getTextContents(renderer) {
  return renderer.root
    .findAll((node) => node.type === "Text")
    .map(getNodeText)
    .filter(Boolean);
}

function hasText(renderer, expectedText) {
  return getTextContents(renderer).some((text) => text.includes(expectedText));
}

function findPressableByText(renderer, expectedText) {
  const matches = renderer.root.findAll(
    (node) => node.type === "Pressable" && getNodeText(node).includes(expectedText)
  );

  if (matches.length === 0) {
    throw new Error(`Could not find Pressable containing text: ${expectedText}`);
  }

  return matches[0];
}

function pressByText(renderer, expectedText) {
  const pressable = findPressableByText(renderer, expectedText);
  TestRenderer.act(() => {
    pressable.props.onPress?.({
      nativeEvent: {},
    });
  });
  return pressable;
}

function findPressableByAccessibilityLabel(renderer, expectedLabel) {
  const matches = renderer.root.findAll(
    (node) => node.type === "Pressable" && node.props.accessibilityLabel === expectedLabel
  );

  if (matches.length === 0) {
    throw new Error(`Could not find Pressable with accessibilityLabel: ${expectedLabel}`);
  }

  return matches[0];
}

function pressByAccessibilityLabel(renderer, expectedLabel) {
  const pressable = findPressableByAccessibilityLabel(renderer, expectedLabel);
  TestRenderer.act(() => {
    pressable.props.onPress?.({
      nativeEvent: {},
      stopPropagation: () => undefined,
    });
  });
  return pressable;
}

function findTextInputByPlaceholder(renderer, expectedPlaceholder) {
  const matches = renderer.root.findAll(
    (node) => node.type === "TextInput" && node.props.placeholder === expectedPlaceholder
  );

  if (matches.length === 0) {
    throw new Error(`Could not find TextInput with placeholder: ${expectedPlaceholder}`);
  }

  return matches[0];
}

function changeTextByPlaceholder(renderer, expectedPlaceholder, value) {
  const input = findTextInputByPlaceholder(renderer, expectedPlaceholder);
  TestRenderer.act(() => {
    input.props.onChangeText?.(value);
  });
  return input;
}

module.exports = {
  React,
  act: TestRenderer.act,
  changeTextByPlaceholder,
  createSpy,
  findPressableByAccessibilityLabel,
  findTextInputByPlaceholder,
  findPressableByText,
  getNodeText,
  getRouter: () => testState.router,
  getTextContents,
  hasText,
  pressByAccessibilityLabel,
  pressByText,
  render,
  resetReactNativeTestState,
  setAppData,
  setBackHandler,
  setLocalSearchParams,
  setOpportunities,
  setPlatformOS,
  setTranslations,
  setWindowDimensions,
  testState,
  unmount,
  update,
};
