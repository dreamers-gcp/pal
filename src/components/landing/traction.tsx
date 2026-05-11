"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function Traction() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <section id="traction" className="py-16 bg-background border-y border-border">
      <motion.div
        ref={ref}
        className="container-tight text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
      >
        <p className="eyebrow">Traction</p>
        <p className="text-muted-foreground text-sm">
          Currently deployed at two premier B-school campuses.
        </p>
        <p className="text-muted-foreground text-xs mt-2">
          Built by alumni of{" "}
          <span className="font-medium text-foreground">BITS Pilani</span> and{" "}
          <span className="font-medium text-foreground">XLRI Jamshedpur</span>.
        </p>
      </motion.div>
    </section>
  );
}
