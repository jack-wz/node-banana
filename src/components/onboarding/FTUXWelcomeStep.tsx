"use client";

import { FTUXStepProps } from "@/types/ftux";
import { useT } from "@/i18n";

export function FTUXWelcomeStep({}: FTUXStepProps) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6">
      <h2 className="text-2xl font-semibold text-neutral-100 mb-3">
        {t("ftux.letsStart")}
      </h2>
      <p className="text-neutral-300 text-center max-w-md leading-relaxed">
        {t("ftux.letsStartHint")}
      </p>
    </div>
  );
}
