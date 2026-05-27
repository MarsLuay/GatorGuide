import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useAppLanguage } from "@/hooks/use-app-language";

import type { TransferPlannerRouteSelection } from "./transfer-planner-routing";

type TransferPlannerPageComponent = React.ComponentType<{
  routeSelection?: TransferPlannerRouteSelection | null;
}>;

type TransferPlannerRouteLoaderProps = {
  routeSelection?: TransferPlannerRouteSelection | null;
};

function TransferPlannerLoadingShell() {
  const { t } = useAppLanguage();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#020617",
      }}
    >
      <ActivityIndicator color="#10b981" />
      <Text
        style={{
          color: "#d1d5db",
          fontSize: 14,
          marginTop: 12,
          textAlign: "center",
        }}
      >
        {t("transferPlanner.loading")}
      </Text>
    </View>
  );
}

export function TransferPlannerRouteLoader({
  routeSelection = null,
}: TransferPlannerRouteLoaderProps) {
  const [TransferPlannerPage, setTransferPlannerPage] =
    useState<TransferPlannerPageComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@/components/pages/TransferPlannerPage").then((module) => {
      if (!cancelled) {
        setTransferPlannerPage(() => module.default);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!TransferPlannerPage) {
    return <TransferPlannerLoadingShell />;
  }

  return <TransferPlannerPage routeSelection={routeSelection} />;
}
