import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Lock, Unlock, Info } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

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

const EMPRESAS = [
  { id: "3", nome: "ANCORA SEGURANÇA" },
  { id: "4", nome: "CI SISTEMAS" },
  { id: "5", nome: "EDINHO ALARMES" },
  { id: "6", nome: "NF MONITORAMENTO" },
  { id: "7", nome: "PROTEJA" },
  { id: "8", nome: "2001 TELECOMUNICAÇÕES" },
  { id: "9", nome: "MSEG" },
  { id: "10", nome: "ELITE MONITORAMENTO" },
  { id: "11", nome: "MRE SEGURANÇA" },
  { id: "12", nome: "GTX TECHNOLOGY" },
  { id: "13", nome: "E-BADAN" },
  { id: "14", nome: "BLETEC" },
  { id: "15", nome: "TELEALARME" },
];

function Index() {
  const [client, setClient] = useState("");
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState<"E" | "R" | null>(null);

  const enviar = async (identification: "E" | "R") => {
    if (!/^\d{4}$/.test(client)) {
      toast.error("A conta do cliente deve ter exatamente 4 dígitos.");
      return;
    }
    if (!organization) {
      toast.error("Selecione a empresa.");
      return;
    }

    const url = `http://192.168.0.120:9000/api/v1/events?client=${encodeURIComponent(
      client,
    )}&partition=01&organization=${encodeURIComponent(
      organization,
    )}&occurrence=401&identification=${identification}&sector=120`;

    setLoading(identification);
    try {
      await fetch(url, { method: "GET", mode: "no-cors" });
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Toaster />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Arme & Desarme Remoto</CardTitle>
          <CardDescription>
            Envie comandos para a central de monitoramento via HTTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este sistema funciona somente para clientes que possuem somente analíticos.
            </AlertDescription>
          </Alert>

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
                {EMPRESAS.map((e) => (
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
