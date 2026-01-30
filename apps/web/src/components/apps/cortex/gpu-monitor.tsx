/**
 * GPU Monitor - GPU utilization and memory metrics
 */

import { Cpu, Gauge, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";

interface GpuMetrics {
  utilization: number;
  memory: number;
  fps: number;
  temperature?: number;
}

export function GpuMonitor() {
  const [metrics, setMetrics] = useState<GpuMetrics>({
    utilization: 0,
    memory: 0,
    fps: 60,
  });

  // Mock metrics update
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        utilization: 20 + Math.random() * 30,
        memory: 400 + Math.random() * 200,
        fps: 58 + Math.random() * 4,
        temperature: 45 + Math.random() * 10,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full items-center justify-around p-4">
      <MetricCard
        color="text-biolum"
        icon={Cpu}
        label="GPU"
        value={`${metrics.utilization.toFixed(0)}%`}
      />
      <MetricCard
        color="text-purple-400"
        icon={HardDrive}
        label="VRAM"
        value={`${metrics.memory.toFixed(0)} MB`}
      />
      <MetricCard
        color="text-green-400"
        icon={Gauge}
        label="FPS"
        value={metrics.fps.toFixed(0)}
      />
      {metrics.temperature && (
        <MetricCard
          color="text-orange-400"
          icon={Cpu}
          label="Temp"
          value={`${metrics.temperature.toFixed(0)}°C`}
        />
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <Icon className={`mx-auto mb-1 h-5 w-5 ${color}`} />
      <div className="font-mono text-lg">{value}</div>
      <div className="text-biolum-dim text-xs">{label}</div>
    </div>
  );
}
