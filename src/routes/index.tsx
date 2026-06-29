import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Unlock, Info, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  addLog,
  buildCommandUrl,
  getSettings,
  type Settings,
} from "@/lib/alarmStorage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arme & Desarme Remoto" },
      { name: "description", content: "Envie comandos de arme e desarme de centrais de alarme via HTTP." },
      { property: "og:title", content: "Arme & Desarme Remoto" },
      { property: "og:description", content: "Envie comandos de arme e desarme de centrais de alarme via HTTP." },
    ],
  }),
  component: Index,
});

function Index() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [operator, setOperator] = useState("");
  const [client, setClient] = useState("");
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState<"E" | "R" | null>(null);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const enviar = async (identification: "E" | "R") => {
    if (!operator.trim()) {
      toast.error("Informe o nome do operador.");
      return;
    }
    if (!/^\d{4}$/.test(client)) {
      toast.error("A conta do cliente deve ter exatamente 4 dígitos.");
      return;
    }
    if (!organization) {
      toast.error("Selecione a empresa.");
      return;
    }
    if (!settings) return;

    const url = buildCommandUrl({
      ip: settings.ip,
      port: settings.port,
      client,
      organization,
      identification,
    });
    const empresa = settings.empresas.find((e) => e.id === organization);

    setLoading(identification);
    try {
      await fetch(url, { method: "GET", mode: "no-cors" });
      addLog({
        operator: operator.trim(),
        client,
        empresaId: organization,
        empresaNome: empresa?.nome ?? organization,
        command: identification === "R" ? "ARMAR" : "DESARMAR",
        url,
      });
      toast.success(
        identification === "R"
          ? `Comando de ARME enviado (conta ${client}).`
          : `Comando de DESARME enviado (conta ${client}).`,
      );
    } catch (err) {
      toast.error("Falha ao enviar o comando. Verifique a rede.");
    } finally {
      setLoading(null);
    }
  };

  if (!settings) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Toaster />
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-2xl">Arme & Desarme Remoto</CardTitle>
            <CardDescription>
              Envie comandos para a central de monitoramento via HTTP.
            </CardDescription>
          </div>
          <Link to="/login">
            <Button variant="outline" size="icon" aria-label="Administrador">
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este sistema funciona somente para clientes que possuem somente analíticos.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="operator">Nome do operador *</Label>
            <Input
              id="operator"
              placeholder="Seu nome"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Conta do cliente (4 dígitos)</Label>
            <Input
              id="client"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={client}
              onChange={(e) => setClient(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={organization} onValueChange={setOrganization}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {settings.empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="default"
              disabled={loading !== null}
              onClick={() => enviar("R")}
            >
              <Lock className="mr-2 h-4 w-4" />
              {loading === "R" ? "Enviando..." : "Armar"}
            </Button>
            <Button
              variant="destructive"
              disabled={loading !== null}
              onClick={() => enviar("E")}
            >
              <Unlock className="mr-2 h-4 w-4" />
              {loading === "E" ? "Enviando..." : "Desarmar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
