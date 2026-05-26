export type HomeTourStep = {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

type BuildHomeTourStepsInput = {
  t: Translate;
  screenWidth: number;
  tabAnchorY: number;
  tourCardLeft: number;
  tourCardWidth: number;
  topAnchor: number;
};

export function buildHomeTourSteps({
  t,
  screenWidth,
  tabAnchorY,
  tourCardLeft,
  tourCardWidth,
  topAnchor,
}: BuildHomeTourStepsInput): HomeTourStep[] {
  return [
    {
      id: "planning",
      title: t("home.tourPlanningTitle"),
      description: t("home.tourPlanningDescription"),
      x: tourCardLeft + tourCardWidth * 0.5,
      y: topAnchor + 360,
    },
    {
      id: "tab-home",
      title: t("navigation.home"),
      description: t("home.tourHomeDescription"),
      x: screenWidth * 0.125,
      y: tabAnchorY,
    },
    {
      id: "tab-resources",
      title: t("navigation.resources"),
      description: t("home.tourResourcesDescription"),
      x: screenWidth * 0.375,
      y: tabAnchorY,
    },
    {
      id: "tab-profile",
      title: t("navigation.profile"),
      description: t("home.tourProfileDescription"),
      x: screenWidth * 0.625,
      y: tabAnchorY,
    },
    {
      id: "tab-settings",
      title: t("navigation.settings"),
      description: t("home.tourSettingsDescription"),
      x: screenWidth * 0.875,
      y: tabAnchorY,
    },
  ];
}

type ResolveHomeTourBubbleLayoutInput = {
  activeTourStep: HomeTourStep | undefined;
  bottomInset: number;
  effectiveFontScale: number;
  screenHeight: number;
  screenWidth: number;
  topInset: number;
};

export function resolveHomeTourBubbleLayout({
  activeTourStep,
  bottomInset,
  effectiveFontScale,
  screenHeight,
  screenWidth,
  topInset,
}: ResolveHomeTourBubbleLayoutInput) {
  const bubbleWidth = Math.min(360, Math.max(260, screenWidth - 24));
  const bubbleHeight = Math.max(150, Math.round(136 * effectiveFontScale));
  const preferBubbleTop = activeTourStep
    ? activeTourStep.y > screenHeight * 0.45
    : false;
  const bubbleTop = activeTourStep
    ? preferBubbleTop
      ? Math.max(topInset + 12, activeTourStep.y - bubbleHeight - 36)
      : Math.min(screenHeight - bubbleHeight - bottomInset - 20, activeTourStep.y + 26)
    : topInset + 12;
  const bubbleLeft = activeTourStep
    ? Math.max(12, Math.min(activeTourStep.x - bubbleWidth / 2, screenWidth - bubbleWidth - 12))
    : 12;
  const pointerOffset = activeTourStep
    ? Math.max(20, Math.min(activeTourStep.x - bubbleLeft - 8, bubbleWidth - 28))
    : 24;

  return {
    bubbleWidth,
    bubbleHeight,
    preferBubbleTop,
    bubbleTop,
    bubbleLeft,
    pointerOffset,
  };
}
