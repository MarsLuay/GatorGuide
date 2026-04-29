import { useEffect } from "react";

import { AppStartupScreen } from "@/components/AppStartupScreen";

export default function StartupAnimation({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 2600);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return <AppStartupScreen />;
}
