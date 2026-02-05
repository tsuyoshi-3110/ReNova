"use client";

import { useMemo, useState } from "react";
import LaundryBoardClient from "./LaundryBoardClient";
import { isDateKey, yyyyMmDd } from "./utils";

export default function LaundryAdminClient({
  projectId,
  initialDate,
}: {
  projectId: string;
  initialDate?: string;
}) {
  const initialDateKey = useMemo(() => {
    if (isDateKey(initialDate)) return initialDate;
    return yyyyMmDd(new Date());
  }, [initialDate]);

  const [dateKey, setDateKey] = useState<string>(initialDateKey);

  return <LaundryBoardClient projectId={projectId} mode="admin" dateKey={dateKey} onDateKeyChange={setDateKey} />;
}
