import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import {
  AnimatedCardPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";

export type SelectorOverlayStrategy = "inline" | "inline-isolated" | "modal";

export type SearchableSelectOption = {
  id: string;
  label: string;
  description?: string;
  searchText?: string;
};

type SearchableSelectProps = {
  value: string;
  open: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  options: SearchableSelectOption[];
  onSelect: (id: string) => void;
  selectedOptionId?: string | null;
  hideSelectedOptionWhenOpen?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
  placeholderTextColor?: string;
  accentColor?: string;
  onTouchStartInside?: () => void;
  overlayStrategy?: SelectorOverlayStrategy;
};

function normalizeSearchableSelectValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function SearchableSelect({
  value,
  open,
  onToggle,
  onDismiss,
  options,
  onSelect,
  selectedOptionId,
  hideSelectedOptionWhenOpen,
  searchable,
  searchPlaceholder,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
  placeholderTextColor = "#9CA3AF",
  accentColor = "#008f4e",
  onTouchStartInside,
  overlayStrategy = "inline",
}: SearchableSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput | null>(null);
  const selectorFieldRef = useRef<View | null>(null);
  const [modalAnchor, setModalAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const markTouchInside = useCallback(() => {
    onTouchStartInside?.();
  }, [onTouchStartInside]);

  const dismissDropdown = useCallback(() => {
    if (onDismiss) {
      onDismiss();
      return;
    }

    onToggle();
  }, [onDismiss, onToggle]);

  const measureModalAnchor = useCallback(() => {
    if (!selectorFieldRef.current) {
      return;
    }

    selectorFieldRef.current.measureInWindow((x, y, width, height) => {
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        return;
      }

      setModalAnchor({
        left: x,
        top: y,
        width,
        height,
      });
    });
  }, []);

  const shouldUseInlineIsolation = overlayStrategy === "inline-isolated";

  useEffect(() => {
    if (!open) {
      searchInputRef.current?.blur();
      setSearchQuery("");
      setModalAnchor(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return;

    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [open, searchable]);

  useEffect(() => {
    if (!open || overlayStrategy !== "modal") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      measureModalAnchor();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [measureModalAnchor, open, overlayStrategy, options.length, value]);

  const normalizedQuery = normalizeSearchableSelectValue(searchQuery);
  const normalizedSelectedValue = normalizeSearchableSelectValue(value);
  const effectiveQuery =
    searchable && open && normalizedQuery === normalizedSelectedValue
      ? ""
      : normalizedQuery;

  const filteredOptions = useMemo(() => {
    const visibleOptions =
      hideSelectedOptionWhenOpen && open && selectedOptionId
        ? options.filter((option) => option.id !== selectedOptionId)
        : options;

    if (!searchable || !effectiveQuery) {
      return visibleOptions;
    }

    const startsWithMatches: SearchableSelectOption[] = [];
    const includesMatches: SearchableSelectOption[] = [];

    for (const option of visibleOptions) {
      const normalizedLabel = normalizeSearchableSelectValue(
        option.searchText ?? option.label
      );

      if (normalizedLabel.startsWith(effectiveQuery)) {
        startsWithMatches.push(option);
        continue;
      }

      if (normalizedLabel.includes(effectiveQuery)) {
        includesMatches.push(option);
      }
    }

    return [...startsWithMatches, ...includesMatches];
  }, [
    effectiveQuery,
    hideSelectedOptionWhenOpen,
    open,
    options,
    searchable,
    selectedOptionId,
  ]);

  const modalDropdownLayout = useMemo(() => {
    if (!modalAnchor) {
      return null;
    }

    const sideMargin = 16;
    const verticalGap = 12;
    const viewportPadding = 24;
    const availableBelow = Math.max(
      windowHeight - (modalAnchor.top + modalAnchor.height + verticalGap) - viewportPadding,
      0
    );
    const availableAbove = Math.max(modalAnchor.top - verticalGap - viewportPadding, 0);
    const shouldOpenUpward = availableBelow < 220 && availableAbove > availableBelow;
    const maxHeight = Math.max(
      160,
      Math.min(320, shouldOpenUpward ? availableAbove : availableBelow)
    );
    const width = Math.min(modalAnchor.width, Math.max(windowWidth - sideMargin * 2, 0));
    const left = Math.min(
      Math.max(modalAnchor.left, sideMargin),
      Math.max(sideMargin, windowWidth - width - sideMargin)
    );
    const top = shouldOpenUpward
      ? Math.max(viewportPadding, modalAnchor.top - verticalGap - maxHeight)
      : modalAnchor.top + modalAnchor.height + verticalGap;

    return {
      left,
      top,
      width,
      maxHeight,
    };
  }, [modalAnchor, windowHeight, windowWidth]);

  const dropdownMaxHeight = modalDropdownLayout?.maxHeight ?? 320;
  const scrollAreaMaxHeight = Math.max(
    120,
    dropdownMaxHeight - (searchable && !effectiveQuery ? 72 : 28)
  );

  const dropdownContent = (
    <View
      className={`border ${borderClass} rounded-2xl p-3`}
      onTouchStart={markTouchInside}
      renderToHardwareTextureAndroid={shouldUseInlineIsolation}
      needsOffscreenAlphaCompositing={shouldUseInlineIsolation}
      style={{
        maxHeight: dropdownMaxHeight,
        backgroundColor: dropdownBackgroundColor,
        overflow: "hidden",
        opacity: 1,
        ...(shouldUseInlineIsolation
          ? {
              shadowColor: "#000000",
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
            }
          : {}),
      }}
    >
      {shouldUseInlineIsolation ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: dropdownBackgroundColor,
            opacity: 1,
          }}
        />
      ) : null}

      {searchable && !effectiveQuery ? (
        <Text className={`${secondaryTextClass} text-xs mb-2`}>
          Scroll to browse all options, or type to filter.
        </Text>
      ) : null}

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        onTouchStart={markTouchInside}
        style={{ maxHeight: scrollAreaMaxHeight, backgroundColor: dropdownBackgroundColor }}
        contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
      >
        {filteredOptions.map((option) => (
          <AnimatedCardPressable
            key={option.id}
            onPressIn={markTouchInside}
            onPress={() => {
              searchInputRef.current?.blur();
              setSearchQuery("");
              onSelect(option.id);
            }}
            className={`border ${borderClass} rounded-2xl px-4 py-4`}
            style={{ backgroundColor: dropdownBackgroundColor, opacity: 1 }}
          >
            <Text className={`${textClass} font-semibold`}>{option.label}</Text>
            {option.description ? (
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {option.description}
              </Text>
            ) : null}
          </AnimatedCardPressable>
        ))}

        {searchable && effectiveQuery && !filteredOptions.length ? (
          <Text className={`${secondaryTextClass} text-sm`}>
            No options match that search yet.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );

  return (
    <View
      ref={selectorFieldRef}
      className="relative"
      style={
        open
          ? shouldUseInlineIsolation
            ? { zIndex: 120, elevation: 120 }
            : { zIndex: 30 }
          : undefined
      }
      onTouchStart={markTouchInside}
      onLayout={() => {
        if (open && overlayStrategy === "modal") {
          measureModalAnchor();
        }
      }}
      renderToHardwareTextureAndroid={open && shouldUseInlineIsolation}
      needsOffscreenAlphaCompositing={open && shouldUseInlineIsolation}
    >
      {searchable ? (
        <View
          className={`border ${borderClass} rounded-2xl px-4 py-2 flex-row items-center`}
          onTouchStart={markTouchInside}
        >
          <TextInput
            ref={searchInputRef}
            value={open ? searchQuery : value}
            onTouchStart={markTouchInside}
            onChangeText={(nextValue) => {
              if (!open) {
                onToggle();
              }
              setSearchQuery(nextValue);
            }}
            onFocus={() => {
              if (!open) {
                setSearchQuery(value);
                onToggle();
              } else if (!searchQuery) {
                setSearchQuery(value);
              }
            }}
            placeholder={searchPlaceholder}
            placeholderTextColor={placeholderTextColor}
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
            className={`${textClass} text-sm flex-1 min-w-0`}
          />
          <AnimatedIconPressable
            onPress={onToggle}
            onPressIn={markTouchInside}
            className="ml-3"
            hitSlop={8}
          >
            <MaterialIcons
              name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={22}
              color={accentColor}
            />
          </AnimatedIconPressable>
        </View>
      ) : (
        <AnimatedCardPressable
          onPress={onToggle}
          onPressIn={markTouchInside}
          className={`border ${borderClass} rounded-2xl px-4 py-4 flex-row items-center justify-between`}
        >
          <View className="flex-1 min-w-0 pr-3">
            <Text className={`${textClass} font-semibold`} numberOfLines={1}>
              {value}
            </Text>
          </View>
          <MaterialIcons
            name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={22}
            color={accentColor}
          />
        </AnimatedCardPressable>
      )}

      {open && overlayStrategy !== "modal" ? (
        <View
          className="absolute left-0 right-0 mt-3"
          style={{
            top: "100%",
            zIndex: shouldUseInlineIsolation ? 125 : 35,
            elevation: shouldUseInlineIsolation ? 125 : 16,
          }}
        >
          {dropdownContent}
        </View>
      ) : null}

      {open && overlayStrategy === "modal" && modalDropdownLayout ? (
        <Modal transparent visible animationType="none" onRequestClose={dismissDropdown}>
          <View style={{ flex: 1 }}>
            {/* touch-audit-ignore: modal dropdown backdrop fills the viewport and only dismisses the menu. */}
            <Pressable
              onPress={dismissDropdown}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <View pointerEvents="box-none" style={{ flex: 1 }}>
              <View
                style={{
                  position: "absolute",
                  left: modalDropdownLayout.left,
                  top: modalDropdownLayout.top,
                  width: modalDropdownLayout.width,
                  zIndex: 200,
                  elevation: 200,
                }}
              >
                {dropdownContent}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
