import { motion } from "framer-motion";

export function Loader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[oklch(0.05_0_0)] text-[oklch(0.99_0_0)]">
      <motion.svg className="h-24 w-24 opacity-80" viewBox="0 0 100 100">
        <motion.circle
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity: [0, 1, 1, 0],
            rotate: 270,
          }}
          cx="50"
          cy="50"
          fill="none"
          initial={{ pathLength: 0, opacity: 0, rotate: -90 }}
          r="40"
          stroke="currentColor"
          strokeWidth="0.5"
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            times: [0, 0.4, 0.6, 1],
          }}
        />
        <motion.circle
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity: [0, 1, 1, 0],
            rotate: -270,
          }}
          cx="50"
          cy="50"
          fill="none"
          initial={{ pathLength: 0, opacity: 0, rotate: 90 }}
          r="30"
          stroke="currentColor"
          strokeWidth="0.5"
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 0.2,
            times: [0, 0.4, 0.6, 1],
          }}
        />
      </motion.svg>
    </div>
  );
}

export default Loader;
