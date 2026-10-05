import {
  BellRing,
  Calendar,
  Clock,
  Lock,
  ShieldOff,
  ShieldPlus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTemScheduleFn,
  deleteAlarmScheduleFn,
  getAlarmSchedulesFn,
  sendTemCommandFn,
} from "@/features/alarm/alarm.functions";
import type { AlarmCommand, AlarmSchedule, TemCommand } from "@/features/alarm/alarm.types";

const SUCCESS_MESSAGES: Record<TemCommand, string> = {
  ARMAR: "Central TEM armada",
  DESARMAR: "Central TEM desarmada",
  ISOLAR: "Setores isolados",
  DESISOLAR: "Isolamento desfeito",
};

/** Parses "1, 2, 5-7" into [1, 2, 5, 6, 7]; returns null when the text is invalid. */
function parseZones(text: string): number[] | null {
  const zones = new Set<number>();

  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const range = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(part);
    if (!range) return null;

    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : start;
    if (start < 1 || end < start || end - start > 63) return null;

    for (let zone = start; zone <= end; zone += 1) zones.add(zone);
  }

  return zones.size > 0 ? [...zones].sort((a, b) => a - b) : null;
}

export function TemCommandPanel() {
  const [operator, setOperator] = useState("");
  const [account, setAccount] = useState("");
  const [pin, setPin] = useState("");
  const [zonesText, setZonesText] = useState("");
  const [loading, setLoading] = useState<TemCommand | null>(null);
  const [schedules, setSchedules] = useState<AlarmSchedule[]>([]);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduling, setScheduling] = useState<AlarmCommand | null>(null);
  const busy = loading !== null || scheduling !== null;

  async function loadSchedules() {
    try {
      const data = await getAlarmSchedulesFn();
      setSchedules(data.filter((item) => item.provider === "TEM"));
    } catch {
      console.error("Erro ao carregar agendamentos TEM.");
    }
  }

  useEffect(() => {
    void loadSchedules();
    const interval = setInterval(() => void loadSchedules(), 10_000);
    return () => clearInterval(interval);
  }, []);

  async function scheduleCommand(command: AlarmCommand) {
    if (operator.trim().length < 2) {
      toast.error("Informe o nome do operador.");
      return;
    }

    if (!/^[A-Za-z0-9]{1,16}$/.test(account)) {
      toast.error("Informe a conta da central.");
      return;
    }

    if (!scheduleDateTime) {
      toast.error("Selecione a data e o horario da acao.");
      return;
    }

    if (new Date(scheduleDateTime) <= new Date()) {
      toast.error("Escolha uma data e horario no futuro.");
      return;
    }

    setScheduling(command);
    try {
      await createTemScheduleFn({
        data: { operator: operator.trim(), account, command, datetime: scheduleDateTime },
      });
      toast.success(
        `${command === "ARMAR" ? "Arme" : "Desarme"} agendado para ${new Date(scheduleDateTime).toLocaleString("pt-BR")}.`,
      );
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

  async function sendCommand(command: TemCommand) {
    if (operator.trim().length < 2) {
      toast.error("Informe o nome do operador.");
      return;
    }

    if (!/^[A-Za-z0-9]{1,16}$/.test(account)) {
      toast.error("Informe a conta da central.");
      return;
    }

    if (pin && !/^\d{4}$/.test(pin)) {
      toast.error("O PIN deve ter 4 digitos.");
      return;
    }

    let zones: number[] | undefined;
    if (command === "ISOLAR" || command === "DESISOLAR") {
      const parsed = parseZones(zonesText);
      if (!parsed) {
        toast.error("Informe os setores. Ex.: 1, 2 ou 3-5.");
        return;
      }
      zones = parsed;
    }

    setLoading(command);
    try {
      await sendTemCommandFn({
        data: { operator: operator.trim(), account, command, pin: pin || undefined, zones },
      });

      const zonesLabel = zones ? `, setores ${zones.join(", ")}` : "";
      toast.success(`${SUCCESS_MESSAGES[command]} (conta ${account}${zonesLabel}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar o comando.";
      toast.error(message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-8 lg:grid-cols-[0.75fr_1.1fr_1.15fr]">
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm">
          <BellRing className="h-4 w-4 text-primary" />
          Integracao TEM
        </div>
        <h2 className="max-w-xl text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Centrais de alarme
        </h2>
        <p className="max-w-lg text-base leading-7 text-muted-foreground">
          Os comandos sao enviados diretamente para a central TEM pela API configurada no painel
          administrativo. Todas as tentativas ficam registradas nos logs.
        </p>
      </section>

      <Card className="overflow-hidden border-primary/20 shadow-lg shadow-primary/10">
        <div className="border-b bg-primary px-6 py-5 text-primary-foreground">
          <p className="text-sm font-medium opacity-90">Central TEM</p>
          <p className="mt-1 text-2xl font-semibold">Selecionar conta e acao</p>
        </div>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="tem-operator">Operador</Label>
            <Input
              id="tem-operator"
              placeholder="Nome do operador"
              value={operator}
              onChange={(event) => setOperator(event.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tem-account">Conta da central</Label>
              <Input
                id="tem-account"
                maxLength={16}
                placeholder="1234"
                value={account}
                onChange={(event) =>
                  setAccount(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 16))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tem-pin">Senha (PIN) da central</Label>
              <Input
                id="tem-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="Vazio usa o PIN padrao"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              className="h-12 text-sm"
              disabled={busy}
              onClick={() => void sendCommand("ARMAR")}
            >
              <Lock className="mr-2 h-4 w-4" />
              {loading === "ARMAR" ? "Enviando..." : "Armar"}
            </Button>
            <Button
              className="h-12 border-primary/30 bg-accent text-sm text-accent-foreground hover:bg-accent/85"
              variant="outline"
              disabled={busy}
              onClick={() => void sendCommand("DESARMAR")}
            >
              <Unlock className="mr-2 h-4 w-4" />
              {loading === "DESARMAR" ? "Enviando..." : "Desarmar"}
            </Button>
          </div>

          <div className="space-y-3 border-t pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Isolar setores
            </span>
            <div className="space-y-1.5">
              <Label htmlFor="tem-zones">Setores</Label>
              <Input
                id="tem-zones"
                placeholder="Ex.: 1, 2 ou 3-5"
                value={zonesText}
                onChange={(event) => setZonesText(event.target.value.replace(/[^\d,;\s-]/g, ""))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-11 bg-amber-600 text-xs text-white hover:bg-amber-700"
                variant="secondary"
                disabled={busy}
                onClick={() => void sendCommand("ISOLAR")}
              >
                <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                {loading === "ISOLAR" ? "Enviando..." : "Isolar setor"}
              </Button>
              <Button
                className="h-11 text-xs"
                variant="outline"
                disabled={busy}
                onClick={() => void sendCommand("DESISOLAR")}
              >
                <ShieldPlus className="mr-1.5 h-3.5 w-3.5" />
                {loading === "DESISOLAR" ? "Enviando..." : "Desfazer isolamento"}
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Agendar acao futura
            </span>
            <div className="space-y-1.5">
              <Label htmlFor="tem-datetime">Data e Hora do Agendamento</Label>
              <Input
                id="tem-datetime"
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(event) => setScheduleDateTime(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-11 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                variant="secondary"
                disabled={busy}
                onClick={() => void scheduleCommand("ARMAR")}
              >
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                {scheduling === "ARMAR" ? "Agendando..." : "Agendar Arme"}
              </Button>
              <Button
                className="h-11 bg-amber-600 text-xs text-white hover:bg-amber-700"
                variant="secondary"
                disabled={busy}
                onClick={() => void scheduleCommand("DESARMAR")}
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                {scheduling === "DESARMAR" ? "Agendando..." : "Agendar Desarme"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Agendamentos usam o PIN padrao configurado no painel administrativo.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/60 shadow-md">
        <div className="border-b bg-card px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Agendamentos TEM pendentes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">Lista de acoes</p>
        </div>
        <CardContent className="p-6">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Calendar className="mb-3 h-10 w-10 text-muted-foreground/45" />
              <p className="text-sm">Nenhum agendamento pendente no momento.</p>
            </div>
          ) : (
            <div className="max-h-[600px] space-y-4 overflow-y-auto pr-1">
              {schedules.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.command === "ARMAR"
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {item.command}
                      </span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        Conta: {item.client}
                      </span>
                    </div>
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
                    className="shrink-0 text-destructive hover:bg-destructive/10"
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
  );
}
