import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAppLanguage } from "@/hooks/use-app-language";

type TransferPlannerPageComponent = React.ComponentType;

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

export default function ResourcesTransferPlanner() {
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

  return <TransferPlannerPage />;
}
