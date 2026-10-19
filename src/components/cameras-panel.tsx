import { ExternalLink, Pencil, Trash2, Video, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CameraLiveView } from "@/components/camera-live-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCameraFn,
  deleteCameraFn,
  listCamerasFn,
  updateCameraFn,
} from "@/features/cameras/camera.functions";
import type { CameraPublic } from "@/features/cameras/camera.types";

type FormState = {
  name: string;
  rtspUrl: string;
  onvifHost: string;
  onvifPort: string;
  username: string;
  password: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  rtspUrl: "",
  onvifHost: "",
  onvifPort: "80",
  username: "admin",
  password: "",
};

export function CamerasPanel() {
  const [cameras, setCameras] = useState<CameraPublic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCameras = useCallback(async () => {
    try {
      const data = await listCamerasFn();
      setCameras(data);
      setSelectedId((current) => {
        if (current && data.some((camera) => camera.id === current)) return current;
        return data[0]?.id ?? null;
      });
    } catch {
      toast.error("Erro ao carregar cameras.");
    }
  }, []);

  useEffect(() => {
    void loadCameras();
  }, [loadCameras]);

  const selected = cameras.find((camera) => camera.id === selectedId) ?? null;
  const isEditing = editingId !== null;

  function openInNewTab(cameraId: string) {
    window.open(`/cameras/${cameraId}`, "_blank", "noopener,noreferrer");
  }

  function startEdit(camera: CameraPublic) {
    setEditingId(camera.id);
    setSelectedId(camera.id);
    setForm({
      name: camera.name,
      rtspUrl: camera.rtspUrl,
      onvifHost: camera.onvifHost,
      onvifPort: String(camera.onvifPort),
      username: camera.username,
      password: "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.rtspUrl.trim() || !form.username.trim()) {
      toast.error("Preencha nome, RTSP e usuario.");
      return;
    }

    if (!isEditing && !form.password) {
      toast.error("Informe a senha da camera.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        rtspUrl: form.rtspUrl.trim(),
        onvifHost: form.onvifHost.trim() || undefined,
        onvifPort: form.onvifPort ? Number(form.onvifPort) : 80,
        username: form.username.trim(),
        password: form.password,
      };

      if (isEditing && editingId) {
        const updated = await updateCameraFn({
          data: { id: editingId, ...payload },
        });
        toast.success(`Camera "${updated.name}" atualizada.`);
        setEditingId(null);
        setForm(EMPTY_FORM);
        await loadCameras();
        setSelectedId(updated.id);
      } else {
        const created = await createCameraFn({ data: payload });
        toast.success(`Camera "${created.name}" cadastrada.`);
        setForm(EMPTY_FORM);
        await loadCameras();
        setSelectedId(created.id);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isEditing
            ? "Falha ao atualizar camera."
            : "Falha ao cadastrar camera.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta camera?")) return;

    try {
      await deleteCameraFn({ data: { id } });
      toast.success("Camera removida.");
      if (editingId === id) cancelEdit();
      await loadCameras();
    } catch {
      toast.error("Falha ao remover camera.");
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-8 lg:grid-cols-[0.9fr_1.2fr]">
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm">
          <Video className="h-4 w-4 text-primary" />
          Cameras RTSP + PTZ
        </div>
        <h2 className="max-w-xl text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Speed dome
        </h2>
        <p className="max-w-lg text-base leading-7 text-muted-foreground">
          Cadastre a camera pelo link RTSP, veja o video ao vivo (FFmpeg) e mova a posicao via
          ONVIF. Use &quot;Abrir em nova aba&quot; para visualizacao dedicada com PTZ.
        </p>

        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-sm font-semibold text-foreground">
              {isEditing ? "Editar camera" : "Nova camera"}
            </p>
            <div className="space-y-2">
              <Label htmlFor="cam-name">Nome</Label>
              <Input
                id="cam-name"
                placeholder="Speed Dome portaria"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cam-rtsp">URL RTSP</Label>
              <Input
                id="cam-rtsp"
                placeholder="rtsp://admin:senha@192.168.0.50:554/cam/realmonitor?channel=1&subtype=0"
                value={form.rtspUrl}
                onChange={(event) => setForm({ ...form, rtspUrl: event.target.value })}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cam-host">Host ONVIF (opcional)</Label>
                <Input
                  id="cam-host"
                  placeholder="IP da camera"
                  value={form.onvifHost}
                  onChange={(event) => setForm({ ...form, onvifHost: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cam-port">Porta ONVIF</Label>
                <Input
                  id="cam-port"
                  inputMode="numeric"
                  value={form.onvifPort}
                  onChange={(event) =>
                    setForm({ ...form, onvifPort: event.target.value.replace(/\D/g, "").slice(0, 5) })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cam-user">Usuario</Label>
                <Input
                  id="cam-user"
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cam-pass">
                  {isEditing ? "Nova senha (opcional)" : "Senha"}
                </Label>
                <Input
                  id="cam-pass"
                  type="password"
                  autoComplete="off"
                  placeholder={isEditing ? "Deixe em branco para manter" : undefined}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={saving}
                  onClick={cancelEdit}
                >
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              ) : null}
              <Button className="flex-1" disabled={saving} onClick={() => void handleSave()}>
                {saving
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar alteracoes"
                    : "Adicionar camera"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-semibold text-foreground">Cameras cadastradas</p>
            {cameras.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma camera cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {cameras.map((camera) => (
                  <div
                    key={camera.id}
                    className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                      selectedId === camera.id ? "border-primary bg-primary/5" : "bg-card"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedId(camera.id)}
                    >
                      <p className="truncate text-sm font-medium text-foreground">{camera.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {camera.onvifHost}:{camera.onvifPort}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openInNewTab(camera.id)}
                        aria-label="Abrir em nova aba"
                        title="Abrir em nova aba"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(camera)}
                        aria-label="Editar camera"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => void handleDelete(camera.id)}
                        aria-label="Remover camera"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <Card className="overflow-hidden border-primary/20 shadow-lg shadow-primary/10">
          <div className="flex items-start justify-between gap-3 border-b bg-primary px-6 py-5 text-primary-foreground">
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-90">Visualizacao</p>
              <p className="mt-1 truncate text-2xl font-semibold">
                {selected ? selected.name : "Selecione uma camera"}
              </p>
            </div>
            {selected ? (
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => openInNewTab(selected.id)}
              >
                <ExternalLink className="mr-1 h-4 w-4" /> Nova aba
              </Button>
            ) : null}
          </div>
          <CardContent className="space-y-4 p-4">
            {selected ? (
              <CameraLiveView key={selected.id} camera={selected} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Cadastre e selecione uma camera para ver o video.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
