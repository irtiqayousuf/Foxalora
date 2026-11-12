"use client";

import { Button, Tooltip } from "@fluentui/react-components";
import { WeatherMoonRegular, WeatherSunnyRegular } from "@fluentui/react-icons";
import { useThemeMode } from "@/theme/Providers";

export function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  const label = mode === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip content={label} relationship="label">
      <Button
        appearance="subtle"
        icon={mode === "dark" ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
        onClick={toggle}
      />
    </Tooltip>
  );
}
