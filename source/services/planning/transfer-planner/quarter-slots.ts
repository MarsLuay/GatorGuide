export type PlanningQuarterKind = "Winter" | "Spring" | "Summer" | "Fall";

export type PlanningQuarterSlot = {
  kind: PlanningQuarterKind;
  year: number;
  label: string;
  start: Date;
  end: Date;
};

function buildLocalQuarterDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function buildPlanningQuarterSlot(
  kind: PlanningQuarterKind,
  year: number
): PlanningQuarterSlot {
  switch (kind) {
    case "Winter":
      return {
        kind,
        year,
        label: `Winter ${year}`,
        start: buildLocalQuarterDate(year, 1, 2),
        end: buildLocalQuarterDate(year, 3, 20),
      };
    case "Spring":
      return {
        kind,
        year,
        label: `Spring ${year}`,
        start: buildLocalQuarterDate(year, 4, 1),
        end: buildLocalQuarterDate(year, 6, 18),
      };
    case "Summer":
      return {
        kind,
        year,
        label: `Summer ${year}`,
        start: buildLocalQuarterDate(year, 7, 1),
        end: buildLocalQuarterDate(year, 8, 21),
      };
    case "Fall":
      return {
        kind,
        year,
        label: `Fall ${year}`,
        start: buildLocalQuarterDate(year, 9, 22),
        end: buildLocalQuarterDate(year, 12, 11),
      };
  }
}

export function getCurrentOrNextQuarterSlot(
  referenceDate = new Date(),
  includeSummerQuarter = false
) {
  const normalizedReference = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const year = normalizedReference.getFullYear();
  const candidateSlots = [
    buildPlanningQuarterSlot("Winter", year),
    buildPlanningQuarterSlot("Spring", year),
    ...(includeSummerQuarter ? [buildPlanningQuarterSlot("Summer", year)] : []),
    buildPlanningQuarterSlot("Fall", year),
    buildPlanningQuarterSlot("Winter", year + 1),
  ];

  for (const slot of candidateSlots) {
    if (normalizedReference >= slot.start && normalizedReference <= slot.end) {
      return slot;
    }

    if (normalizedReference < slot.start) {
      return slot;
    }
  }

  return buildPlanningQuarterSlot("Winter", year + 1);
}

export function getNextPlannedQuarterSlot(
  currentSlot: PlanningQuarterSlot,
  includeSummerQuarter = false
): PlanningQuarterSlot {
  switch (currentSlot.kind) {
    case "Winter":
      return buildPlanningQuarterSlot("Spring", currentSlot.year);
    case "Spring":
      return includeSummerQuarter
        ? buildPlanningQuarterSlot("Summer", currentSlot.year)
        : buildPlanningQuarterSlot("Fall", currentSlot.year);
    case "Summer":
      return buildPlanningQuarterSlot("Fall", currentSlot.year);
    case "Fall":
      return buildPlanningQuarterSlot("Winter", currentSlot.year + 1);
  }
}

export function buildQuarterSlots(referenceDate = new Date(), includeSummerQuarter = false) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const fallYear = month >= 8 ? year + 1 : year;
  const slots: PlanningQuarterSlot[] = [];
  let slot = buildPlanningQuarterSlot("Fall", fallYear);

  while (slots.length < 3) {
    slots.push(slot);
    slot = getNextPlannedQuarterSlot(slot, includeSummerQuarter);
  }

  return slots;
}

export function buildQuarterSlotsAfterCurrent(
  referenceDate = new Date(),
  includeSummerQuarter = false
) {
  const slots: PlanningQuarterSlot[] = [];
  let slot = getCurrentOrNextQuarterSlot(referenceDate, includeSummerQuarter);

  while (slots.length < 3) {
    slot = getNextPlannedQuarterSlot(slot, includeSummerQuarter);
    slots.push(slot);
  }

  return slots;
}
