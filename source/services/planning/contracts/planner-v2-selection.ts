/**
 * Map Transfer Planner selection → plannerV2.activeTarget (P11/P13 bridge).
 */

export type PlannerSelectionSnapshot = {
  isUwPlanner: boolean;
  campusId?: string | null;
  campusTitle?: string | null;
  majorId?: string | null;
  majorTitle?: string | null;
  intendedTransferQuarter?: string | null;
  preferredLoad?: number | null;
};

export type PlannerV2ActiveTarget = {
  runtimeId: string;
  campus: string | null;
  programId: string | null;
  label: string | null;
  college: "uw" | "grc";
};

export function buildPlannerV2PatchFromSelection(
  selection: PlannerSelectionSnapshot
): {
  activeTarget: PlannerV2ActiveTarget | null;
  intendedTransferQuarter: string | null;
  preferredLoad: number | null;
} {
  const campus = String(selection.campusId || "").trim() || null;
  const programId = String(selection.majorId || "").trim() || null;
  if (!selection.isUwPlanner || !campus || !programId) {
    return {
      activeTarget: null,
      intendedTransferQuarter:
        String(selection.intendedTransferQuarter || "").trim() || null,
      preferredLoad:
        typeof selection.preferredLoad === "number" && Number.isFinite(selection.preferredLoad)
          ? selection.preferredLoad
          : null,
    };
  }

  const runtimeId = `uw:${campus}:${programId}`;
  return {
    activeTarget: {
      runtimeId,
      campus,
      programId,
      label: selection.majorTitle || selection.campusTitle || runtimeId,
      college: "uw",
    },
    intendedTransferQuarter:
      String(selection.intendedTransferQuarter || "").trim() || null,
    preferredLoad:
      typeof selection.preferredLoad === "number" && Number.isFinite(selection.preferredLoad)
        ? selection.preferredLoad
        : null,
  };
}
