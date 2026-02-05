"use client";

import { useEffect, useState } from "react";
import LaundryBoardClient from "./LaundryBoardClient";
import { yyyyMmDd } from "./utils";

function todayKey(): string {
  return yyyyMmDd(new Date());
}

export default function LaundryResidentClient({ projectId }: { projectId: string }) {
  const [dateKey, setDateKey] = useState<string>(() => todayKey());

  useEffect(() => {
    const t = window.setInterval(() => {
      const k = todayKey();
      setDateKey((prev) => (prev === k ? prev : k));
    }, 60_000);

    return () => window.clearInterval(t);
  }, []);

  return <LaundryBoardClient projectId={projectId} mode="resident" dateKey={dateKey} />;
}
