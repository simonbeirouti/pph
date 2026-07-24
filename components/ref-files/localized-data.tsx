"use client";

import * as React from "react";
import { cn } from "@eva/ui/lib/utils";

type LocalizedDateProps = {
  readonly className?: string;
  readonly options?: Intl.DateTimeFormatOptions;
  readonly value: string;
};

function stableFallback(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const iso = date.toISOString();

  if (options?.timeStyle || options?.hour || options?.minute || options?.second) {
    return iso.slice(0, 16).replace("T", " ");
  }

  return iso.slice(0, 10);
}

function formatForDevice(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function LocalizedDate({
  className,
  options,
  value,
}: LocalizedDateProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const label = mounted
    ? formatForDevice(value, options)
    : stableFallback(value, options);

  return (
    <time className={cn(className)} dateTime={value}>
      {label}
    </time>
  );
}
