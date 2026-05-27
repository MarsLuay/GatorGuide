import { useEffect, useMemo, useState } from "react";

import type {
  TransferPlannerDemoReviewPayload,
  TransferPlannerDemoReviewProgram,
} from "@/constants/transfer-planner-source/demo/complete-diagnostics";

export const isTransferPlannerDemoMode =
  process.env.EXPO_PUBLIC_GATORGUIDE_DEMO_MODE === "1" ||
  process.env.GATORGUIDE_DEMO_MODE === "1";

export type TransferPlannerDemoReviewState = {
  isEnabled: boolean;
  isLoading: boolean;
  reviewedMajorCount: number;
  generatedAt: string | null;
  programs: TransferPlannerDemoReviewProgram[];
};

let cachedDemoPayload: TransferPlannerDemoReviewPayload | null = null;
let pendingDemoPayload: Promise<TransferPlannerDemoReviewPayload> | null = null;

function loadTransferPlannerDemoPayload() {
  if (cachedDemoPayload) {
    return Promise.resolve(cachedDemoPayload);
  }

  pendingDemoPayload =
    pendingDemoPayload ??
    import("@/constants/transfer-planner-source/demo/complete-diagnostics").then((module) => {
      cachedDemoPayload = module.TRANSFER_PLANNER_DEMO_REVIEW_PAYLOAD;
      return cachedDemoPayload;
    });

  return pendingDemoPayload;
}

export function useTransferPlannerDemoReview(
  planId: string | null | undefined
): TransferPlannerDemoReviewState {
  const [payload, setPayload] = useState<TransferPlannerDemoReviewPayload | null>(
    cachedDemoPayload
  );

  useEffect(() => {
    if (!isTransferPlannerDemoMode) {
      return;
    }

    let cancelled = false;
    void loadTransferPlannerDemoPayload().then((nextPayload) => {
      if (!cancelled) {
        setPayload(nextPayload);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const normalizedPlanId = String(planId ?? "").trim();
    const programs =
      isTransferPlannerDemoMode && normalizedPlanId
        ? payload?.programsByPlanId[normalizedPlanId] ?? []
        : [];

    return {
      isEnabled: isTransferPlannerDemoMode,
      isLoading: isTransferPlannerDemoMode && !payload,
      reviewedMajorCount: payload?.summary.reviewedMajorCount ?? 0,
      generatedAt: payload?.generatedAt ?? null,
      programs,
    };
  }, [payload, planId]);
}
