"use client";

import { useT } from "@/i18n";

interface FTUXReadyStepProps {
  onStartTutorial: () => void;
  onComplete: () => void;
}

export function FTUXReadyStep({ onStartTutorial, onComplete }: FTUXReadyStepProps) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-12 px-8">
      <h2 className="text-2xl font-semibold text-neutral-100 mb-4">
        {t("ftux.readyTitle")}
      </h2>
      <p className="text-neutral-300 text-center leading-relaxed mb-8">
        {t("ftux.readyHint")}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onComplete}
          className="px-5 py-2.5 text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
        >
          {t("ftux.skip")}
        </button>
        <button
          type="button"
          onClick={onStartTutorial}
          className="px-5 py-2.5 text-sm bg-white text-neutral-900 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
        >
          {t("ftux.startTutorial")}
        </button>
      </div>
    </div>
  );
}
