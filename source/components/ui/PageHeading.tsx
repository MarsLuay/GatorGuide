import React, { type ReactNode } from "react";
import { Platform, Text } from "react-native";

type PageHeadingProps = {
  children: ReactNode;
  className?: string;
};

export function PageHeading({ children, className }: PageHeadingProps) {
  if (Platform.OS === "web") {
    return (
      <h1 className={className} style={{ margin: 0 }}>
        {children}
      </h1>
    );
  }

  return (
    <Text accessibilityRole="header" className={className}>
      {children}
    </Text>
  );
}
