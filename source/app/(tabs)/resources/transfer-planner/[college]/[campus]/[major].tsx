import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import { TransferPlannerRouteLoader } from "@/components/transfer-planner/TransferPlannerRouteLoader";
import {
  getTransferPlannerRouteSelection,
  type TransferPlannerRouteParams,
} from "@/components/transfer-planner/transfer-planner-routing";

export default function ResourcesTransferPlannerMajor() {
  const params = useLocalSearchParams<TransferPlannerRouteParams>();
  const routeSelection = useMemo(
    () => getTransferPlannerRouteSelection(params),
    [params]
  );

  return <TransferPlannerRouteLoader routeSelection={routeSelection} />;
}
