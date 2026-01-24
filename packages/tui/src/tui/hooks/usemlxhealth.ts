import { useEffect, useState } from "react";

export function useMlxHealth() {
  const [healthy, setHealthy] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Use environment variable if available, otherwise default to local
        const baseUrl =
          process.env.VLLM_MLX_BASE_URL ?? "http://localhost:8000/v1";
        const url = new URL(baseUrl);
        // vllm-mlx has a health endpoint at /health or we can check /v1/models
        url.pathname = "/health";

        const response = await fetch(url.toString());
        setHealthy(response.ok);

        if (response.ok) {
          // Try to get current model
          url.pathname = "/v1/models";
          const modelsRes = await fetch(url.toString());
          if (modelsRes.ok) {
            const data = await modelsRes.json();
            if (data.data && data.data.length > 0) {
              setModel(data.data[0].id);
            }
          }
        }
      } catch {
        setHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { healthy, model };
}
