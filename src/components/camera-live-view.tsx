import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Minus,
  Plus,
  Square,
} from "lucide-react";
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { warmupPtzSessionFn } from "@/features/cameras/camera.functions";
import type { CameraPublic, PtzAction } from "@/features/cameras/camera.types";

type CameraLiveViewProps = {
  camera: CameraPublic;
  /** Larger video area for the dedicated tab. */
  large?: boolean;
};

export function CameraLiveView({ camera, large = false }: CameraLiveViewProps) {
  const [liveSrc, setLiveSrc] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "live" | "error">(
    "connecting",
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let objectUrl: string | null = null;
    let inFlight = false;

    setLiveStatus("connecting");
    setLiveError(null);
    setLiveSrc(null);

    async function pullFrame() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/cameras/${camera.id}/stream?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        const nextUrl = URL.createObjectURL(blob);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = nextUrl;
        setLiveSrc(nextUrl);
        setLiveStatus("live");
        setLiveError(null);
      } catch (error) {
        if (cancelled) return;
        setLiveStatus("error");
        setLiveError(error instanceof Error ? error.message : "Falha ao carregar o video.");
      } finally {
        inFlight = false;
        if (!cancelled) {
          timer = setTimeout(() => void pullFrame(), 180);
        }
      }
    }

    void pullFrame();
    void warmupPtzSessionFn({ data: { id: camera.id } }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [camera.id]);

  function sendPtz(action: PtzAction) {
    void fetch(`/api/cameras/${camera.id}/ptz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then(async (response) => {
        if (response.ok || action === "stop") return;
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(payload?.message || `Falha no comando PTZ (HTTP ${response.status}).`);
      })
      .catch(() => {
        if (action !== "stop") toast.error("Falha no comando PTZ.");
      });
  }

  function bindPtz(action: Exclude<PtzAction, "stop">) {
    return {
      onPointerDown: (event: ReactPointerEvent) => {
        event.preventDefault();
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        sendPtz(action);
      },
      onPointerUp: () => sendPtz("stop"),
      onPointerLeave: () => sendPtz("stop"),
      onPointerCancel: () => sendPtz("stop"),
    };
  }

  return (
    <div className="space-y-4">
      <div
        className={`relative overflow-hidden rounded-md border bg-black ${
          large ? "min-h-[70vh] aspect-video" : "aspect-video"
        }`}
      >
        {liveSrc ? (
          <img
            src={liveSrc}
            alt={`Ao vivo ${camera.name}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <Camera className="h-10 w-10 opacity-40" />
            <p className="text-sm">
              {liveStatus === "connecting"
                ? "Conectando a camera..."
                : liveError || "Aguardando imagem..."}
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
          {liveStatus === "live"
            ? "AO VIVO"
            : liveStatus === "connecting"
              ? "CONECTANDO"
              : liveStatus === "error"
                ? "ERRO"
                : "OFF"}
        </div>
      </div>

      {liveError ? <p className="text-sm text-destructive">{liveError}</p> : null}

      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Controle PTZ
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div />
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Mover para cima"
            {...bindPtz("up")}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <div />
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Mover para esquerda"
            {...bindPtz("left")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11"
            aria-label="Parar"
            onClick={() => sendPtz("stop")}
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Mover para direita"
            {...bindPtz("right")}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div />
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Mover para baixo"
            {...bindPtz("down")}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <div />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10" aria-label="Zoom out" {...bindPtz("zoomOut")}>
            <Minus className="mr-1 h-4 w-4" /> Zoom -
          </Button>
          <Button variant="outline" className="h-10" aria-label="Zoom in" {...bindPtz("zoomIn")}>
            <Plus className="mr-1 h-4 w-4" /> Zoom +
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Segure a seta para mover; ao soltar, a camera para.
        </p>
      </div>
    </div>
  );
}
