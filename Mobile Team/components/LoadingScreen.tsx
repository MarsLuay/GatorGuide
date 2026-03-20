import { View } from "react-native";
import { ScreenBackground } from "./layouts/ScreenBackground";
import { StateCard } from "@/components/ui/StateCard";

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <ScreenBackground>
      <View className="flex-1 items-center justify-center px-6">
        <StateCard variant="loading" title={message} className="w-full max-w-md" />
      </View>
    </ScreenBackground>
  );
}
