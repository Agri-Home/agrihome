"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ClientChartFrame({
  skeleton,
  children
}: {
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  if (!mounted) return <>{skeleton}</>;
  return <>{children}</>;
}
