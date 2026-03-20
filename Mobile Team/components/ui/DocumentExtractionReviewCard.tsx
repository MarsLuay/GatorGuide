import React from "react";
import { Pressable, Text, View } from "react-native";

type DocumentExtractionReviewCardProps = {
  title: string;
  subtitle: string;
  fileName: string;
  confidenceText?: string | null;
  emptyStateText: string;
  applyLabel: string;
  dismissLabel: string;
  currentValueLabel: string;
  suggestedValueLabel: string;
  confidenceLabel: string;
  cardBgClass: string;
  textClass: string;
  secondaryTextClass: string;
  items: {
    id: string;
    label: string;
    currentValue: string | null;
    suggestedValue: string;
    sourceSnippet: string | null;
    confidence: number | null;
  }[];
  uncertainties: string[];
  onApply: () => void;
  onDismiss: () => void;
  isApplying?: boolean;
};

export function DocumentExtractionReviewCard({
  title,
  subtitle,
  fileName,
  confidenceText,
  emptyStateText,
  applyLabel,
  dismissLabel,
  currentValueLabel,
  suggestedValueLabel,
  confidenceLabel,
  cardBgClass,
  textClass,
  secondaryTextClass,
  items,
  uncertainties,
  onApply,
  onDismiss,
  isApplying = false,
}: DocumentExtractionReviewCardProps) {
  return (
    <View className={`${cardBgClass} border rounded-2xl p-4`}>
      <Text className={`text-base font-semibold ${textClass}`}>{title}</Text>
      <Text className={`text-sm mt-1 ${secondaryTextClass}`}>{subtitle}</Text>
      <Text className={`text-xs mt-2 ${secondaryTextClass}`}>{fileName}</Text>
      {confidenceText ? <Text className={`text-xs mt-1 ${secondaryTextClass}`}>{confidenceText}</Text> : null}

      <View className="mt-4 gap-3">
        {items.length ? (
          items.map((item) => (
            <View key={item.id} className="rounded-xl border border-emerald-300/40 px-3 py-3">
              <Text className={`text-sm font-semibold ${textClass}`}>{item.label}</Text>
              {item.currentValue ? (
                <Text className={`text-xs mt-1 ${secondaryTextClass}`}>{currentValueLabel}: {item.currentValue}</Text>
              ) : null}
              <Text className={`text-sm mt-1 ${textClass}`}>{suggestedValueLabel}: {item.suggestedValue}</Text>
              {item.sourceSnippet ? (
                <Text className={`text-xs mt-2 ${secondaryTextClass}`}>{item.sourceSnippet}</Text>
              ) : null}
              {typeof item.confidence === "number" ? (
                <Text className={`text-xs mt-1 ${secondaryTextClass}`}>{confidenceLabel}: {item.confidence}%</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text className={`text-sm ${secondaryTextClass}`}>{emptyStateText}</Text>
        )}
      </View>

      {uncertainties.length ? (
        <View className="mt-4">
          {uncertainties.slice(0, 3).map((item, index) => (
            <Text key={`${fileName}-uncertainty-${index}`} className={`text-xs ${secondaryTextClass}`}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}

      <View className="flex-row gap-3 mt-4">
        <Pressable
          onPress={onDismiss}
          className={`${cardBgClass} border rounded-lg px-4 py-3 flex-1 items-center`}
        >
          <Text className={secondaryTextClass}>{dismissLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onApply}
          disabled={isApplying || !items.length}
          className={`rounded-lg px-4 py-3 flex-1 items-center ${items.length ? "bg-emerald-500" : "bg-emerald-200"}`}
        >
          <Text className={items.length ? "text-emerald-950 font-semibold" : "text-emerald-800"}>
            {isApplying ? `${applyLabel}...` : applyLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
