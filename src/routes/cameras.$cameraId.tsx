import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CameraLiveView } from "@/components/camera-live-view";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { listCamerasFn } from "@/features/cameras/camera.functions";
import type { CameraPublic } from "@/features/cameras/camera.types";

export const Route = createFileRoute("/cameras/$cameraId")({
  head: ({ params }) => ({
    meta: [{ title: `Camera ${params.cameraId}` }],
  }),
  component: CameraViewerPage,
});

function CameraViewerPage() {
  const { cameraId } = Route.useParams();
  const [camera, setCamera] = useState<CameraPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const cameras = await listCamerasFn();
        if (cancelled) return;
        const found = cameras.find((item) => item.id === cameraId) ?? null;
        setCamera(found);
        setMissing(!found);
        if (found) {
          document.title = `${found.name} — Camera`;
        }
      } catch {
        if (!cancelled) {
          toast.error("Erro ao carregar a camera.");
          setMissing(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [cameraId]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Visualizacao
            </p>
            <h1 className="truncate text-xl font-semibold text-foreground">
              {camera?.name ?? (loading ? "Carregando..." : "Camera")}
            </h1>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Abrindo camera...</p>
        ) : missing || !camera ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm">
            <p className="font-medium text-destructive">Camera nao encontrada.</p>
            <p className="mt-2 text-muted-foreground">
              Ela pode ter sido removida. Volte a aba Cameras e abra novamente.
            </p>
          </div>
        ) : (
          <CameraLiveView camera={camera} large />
        )}
      </main>
    </div>
  );
}
