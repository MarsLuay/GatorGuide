import React, { useEffect, useState } from "react";
import { ActivityIndicator, InteractionManager, Text, View } from "react-native";
import { useAppLanguage } from "@/hooks/use-app-language";

type TransferEquivalencyCatalogComponent = React.ComponentType;

function TransferEquivalenciesLoadingShell() {
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
        {t("transferEquivalencies.loading")}
      </Text>
    </View>
  );
}

export default function TransferEquivalenciesRoute() {
  const [TransferEquivalencyCatalogPage, setTransferEquivalencyCatalogPage] =
    useState<TransferEquivalencyCatalogComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void import("@/components/pages/TransferEquivalencyCatalogPage").then((module) => {
        if (!cancelled) {
          setTransferEquivalencyCatalogPage(() => module.default);
        }
      });
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, []);

  if (!TransferEquivalencyCatalogPage) {
    return <TransferEquivalenciesLoadingShell />;
  }

  return <TransferEquivalencyCatalogPage />;
}
