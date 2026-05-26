import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";

type SettingsDialogProps = {
  allowBackdropDismiss?: boolean;
  bottomPadding: number;
  cardBgClass: string;
  children: ReactNode;
  dialogHorizontalPadding: number;
  dialogMaxWidth: number;
  dialogPadding: number;
  keyboardVerticalOffset: number;
  onRequestClose: () => void;
  topPadding: number;
  visible: boolean;
};

export function SettingsDialog({
  allowBackdropDismiss = true,
  bottomPadding,
  cardBgClass,
  children,
  dialogHorizontalPadding,
  dialogMaxWidth,
  dialogPadding,
  keyboardVerticalOffset,
  onRequestClose,
  topPadding,
  visible,
}: SettingsDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? keyboardVerticalOffset : 0}
      >
        <View className="bg-black/55" style={{ flex: 1 }}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            {/* touch-audit-ignore: settings modal backdrop is a full-screen dismiss surface, not a product control. */}
            <Pressable
              accessible={false}
              disabled={!allowBackdropDismiss}
              onPress={onRequestClose}
              style={{
                flexGrow: 1,
                justifyContent: "center",
                paddingHorizontal: dialogHorizontalPadding,
                paddingTop: topPadding,
                paddingBottom: bottomPadding,
              }}
            >
              {/* touch-audit-ignore: inner modal shell only stops backdrop dismissal so form controls can receive taps. */}
              <Pressable
                accessible={false}
                onPress={(event) => event.stopPropagation()}
                className={`w-full self-center ${cardBgClass} border rounded-3xl`}
                style={{ maxWidth: dialogMaxWidth, padding: dialogPadding }}
              >
                {children}
              </Pressable>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
