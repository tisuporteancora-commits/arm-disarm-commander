import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Calendar, Clock, Lock, Moon, Settings as SettingsIcon, ShieldCheck, Sun, Trash2, Unlock } from "lucide-react";
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
import {
  createAlarmScheduleFn,
  deleteAlarmScheduleFn,
  getAlarmSchedulesFn,
  getCommandCompaniesFn,
  sendAlarmCommandFn,
} from "@/features/alarm/alarm.functions";
import type { AlarmCommand, AlarmSchedule, Company } from "@/features/alarm/alarm.types";

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

  // Theme states
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");

    const handleThemeChange = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };

    window.addEventListener("theme-change", handleThemeChange);
    return () => window.removeEventListener("theme-change", handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.theme = isDark ? "dark" : "light";
    window.dispatchEvent(new Event("theme-change"));
  };

  // Scheduling states
  const [schedules, setSchedules] = useState<AlarmSchedule[]>([]);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduling, setScheduling] = useState<AlarmCommand | null>(null);

  async function loadSchedules() {
    try {
      const data = await getAlarmSchedulesFn();
      setSchedules(data);
    } catch {
      console.error("Erro ao carregar agendamentos.");
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setCompanies(await getCommandCompaniesFn());
        await loadSchedules();
      } catch {
        toast.error("Erro ao carregar as empresas.");
      } finally {
        setInitializing(false);
      }
    }

    void load();

    // Poll schedules every 10 seconds to sync with server execution
    const interval = setInterval(() => {
      void loadSchedules();
    }, 10_000);

    return () => clearInterval(interval);
  }, []);

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

  async function scheduleCommand(command: AlarmCommand) {
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

    if (!scheduleDateTime) {
      toast.error("Selecione a data e o horario da acao.");
      return;
    }

    const company = companies.find((c) => c.id === organization);
    if (!company) return;

    setScheduling(command);
    try {
      await createAlarmScheduleFn({
        data: {
          operator: operator.trim(),
          client,
          organization,
          companyName: company.name,
          command,
          datetime: scheduleDateTime,
        },
      });

      toast.success(`Agendamento de ${command} cadastrado com sucesso.`);
      setScheduleDateTime("");
      await loadSchedules();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar agendamento.";
      toast.error(message);
    } finally {
      setScheduling(null);
    }
  }

  async function deleteSchedule(id: string) {
    try {
      await deleteAlarmScheduleFn({ data: { id } });
      toast.success("Agendamento excluido.");
      await loadSchedules();
    } catch {
      toast.error("Falha ao excluir agendamento.");
    }
  }

  if (initializing) return null;

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-ancora.png"
              alt="Âncora Segurança Patrimonial"
              className="h-12 w-auto"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Operacao remota
              </p>
              <h1 className="text-xl font-semibold text-foreground">Arme & Desarme</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link to="/admin">
              <Button variant="outline" size="icon" aria-label="Administrador">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-black">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="font-semibold">
            Atenção: Este comando funciona somente em clientes que possuem apenas
            analítico.
          </p>
        </div>
      </div>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl items-start gap-6 px-4 py-8 lg:grid-cols-[0.75fr_1.1fr_1.15fr]">
        {/* Coluna 1: Informacoes */}
        <section className="space-y-6 lg:sticky lg:top-4">
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

        {/* Coluna 2: Painel de Comando */}
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

            <div className="space-y-1 pt-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Execucao imediata
              </span>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-12 text-sm"
                  variant="default"
                  disabled={loading !== null || scheduling !== null}
                  onClick={() => void sendCommand("ARMAR")}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  {loading === "ARMAR" ? "Enviando..." : "Armar"}
                </Button>
                <Button
                  className="h-12 border-primary/30 bg-accent text-accent-foreground hover:bg-accent/85 text-sm"
                  variant="outline"
                  disabled={loading !== null || scheduling !== null}
                  onClick={() => void sendCommand("DESARMAR")}
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  {loading === "DESARMAR" ? "Enviando..." : "Desarmar"}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Agendar acao futura
              </span>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="datetime">Data e Hora do Agendamento</Label>
                  <div className="relative">
                    <Input
                      id="datetime"
                      type="datetime-local"
                      value={scheduleDateTime}
                      onChange={(event) => setScheduleDateTime(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="h-11 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    variant="secondary"
                    disabled={loading !== null || scheduling !== null}
                    onClick={() => void scheduleCommand("ARMAR")}
                  >
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    {scheduling === "ARMAR" ? "Agendando..." : "Agendar Arme"}
                  </Button>
                  <Button
                    className="h-11 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    variant="secondary"
                    disabled={loading !== null || scheduling !== null}
                    onClick={() => void scheduleCommand("DESARMAR")}
                  >
                    <Clock className="mr-1.5 h-3.5 w-3.5" />
                    {scheduling === "DESARMAR" ? "Agendando..." : "Agendar Desarme"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coluna 3: Agendamentos de Arme/Desarme */}
        <Card className="overflow-hidden border-border/60 shadow-md">
          <div className="border-b bg-card px-6 py-5">
            <p className="text-sm font-medium text-muted-foreground">Agendamentos pendentes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">Lista de acoes</p>
          </div>
          <CardContent className="p-6">
            {schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 text-muted-foreground/45 mb-3" />
                <p className="text-sm">Nenhum agendamento pendente no momento.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {schedules.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.command === "ARMAR"
                              ? "bg-primary/10 text-primary"
                              : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {item.command === "ARMAR" ? "ARMAR" : "DESARMAR"}
                        </span>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          Conta: {item.client}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate text-foreground">
                        {item.companyName}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.datetime).toLocaleString("pt-BR")}
                        </span>
                        <span className="truncate">Op: {item.operator}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => void deleteSchedule(item.id)}
                      aria-label="Excluir agendamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
