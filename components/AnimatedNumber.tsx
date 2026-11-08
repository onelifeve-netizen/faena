"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate, motion } from "framer-motion";

export default function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => (format ? format(v) : Math.round(v).toLocaleString("es-AR")));
  const first = useRef(true);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: first.current ? 0.9 : 0.5,
      ease: "easeOut" as const,
    });
    first.current = false;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
}
