import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, Settings as SettingsIcon, ShieldCheck, Unlock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { getCommandCompaniesFn, sendAlarmCommandFn } from "@/features/alarm/alarm.functions";
import type { AlarmCommand, Company } from "@/features/alarm/alarm.types";
import { getSessionFn } from "@/features/auth/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arme & Desarme Remoto" },
      {
        name: "description",
        content: "Envie comandos de arme e desarme de centrais de alarme via HTTP.",
      },
      { property: "og:title", content: "Arme & Desarme Remoto" },
      {
        property: "og:description",
        content: "Envie comandos de arme e desarme de centrais de alarme via HTTP.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [operator, setOperator] = useState("");
  const [client, setClient] = useState("");
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState<AlarmCommand | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const session = await getSessionFn();
        if (!session.authenticated) {
          navigate({ to: "/login" });
          return;
        }

        setCompanies(await getCommandCompaniesFn());
      } catch {
        navigate({ to: "/login" });
      } finally {
        setInitializing(false);
      }
    }

    void load();
  }, [navigate]);

  async function sendCommand(command: AlarmCommand) {
    if (!operator.trim()) {
      toast.error("Informe o nome do operador.");
      return;
    }

    if (!/^\d{4}$/.test(client)) {
      toast.error("A conta do cliente deve ter exatamente 4 digitos.");
      return;
    }

    if (!organization) {
      toast.error("Selecione a empresa.");
      return;
    }

    setLoading(command);
    try {
      await sendAlarmCommandFn({
        data: {
          operator: operator.trim(),
          client,
          organization,
          command,
        },
      });

      toast.success(
        command === "ARMAR"
          ? `Comando de ARME confirmado (conta ${client}).`
          : `Comando de DESARME confirmado (conta ${client}).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar o comando.";
      toast.error(message);
    } finally {
      setLoading(null);
    }
  }

  if (initializing) return null;

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Operacao remota
            </p>
            <h1 className="text-xl font-semibold text-foreground">Arme & Desarme</h1>
          </div>
          <Link to="/admin">
            <Button variant="outline" size="icon" aria-label="Administrador">
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl items-center gap-6 px-4 py-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Comando autenticado no servidor
          </div>
          <div className="space-y-4">
            <h2 className="max-w-xl text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Controle operacional de alarmes
            </h2>
            <p className="max-w-lg text-base leading-7 text-muted-foreground">
              As tentativas ficam registradas com operador, conta, empresa, status HTTP e erro
              quando houver falha.
            </p>
          </div>
          <div className="grid max-w-lg grid-cols-2 gap-3">
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Empresas
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{companies.length}</p>
            </div>
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Modo
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">Online</p>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden border-primary/20 shadow-lg shadow-primary/10">
          <div className="border-b bg-primary px-6 py-5 text-primary-foreground">
            <p className="text-sm font-medium opacity-90">Painel de comando</p>
            <p className="mt-1 text-2xl font-semibold">Selecionar conta e acao</p>
          </div>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="operator">Operador</Label>
              <Input
                id="operator"
                placeholder="Nome do operador"
                value={operator}
                onChange={(event) => setOperator(event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
              <div className="space-y-2">
                <Label htmlFor="client">Conta</Label>
                <Input
                  id="client"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={client}
                  onChange={(event) => setClient(event.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>

              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={organization} onValueChange={setOrganization}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                className="h-14 text-base"
                variant="default"
                disabled={loading !== null}
                onClick={() => void sendCommand("ARMAR")}
              >
                <Lock className="mr-2 h-5 w-5" />
                {loading === "ARMAR" ? "Enviando..." : "Armar"}
              </Button>
              <Button
                className="h-14 border-primary/30 bg-accent text-accent-foreground hover:bg-accent/85"
                variant="outline"
                disabled={loading !== null}
                onClick={() => void sendCommand("DESARMAR")}
              >
                <Unlock className="mr-2 h-5 w-5" />
                {loading === "DESARMAR" ? "Enviando..." : "Desarmar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
