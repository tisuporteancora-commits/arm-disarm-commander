import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import {
  clearAlarmLogsFn,
  getAdminStateFn,
  saveAlarmSettingsFn,
} from "@/features/alarm/alarm.functions";
import type { AlarmLogEntry, AlarmSettings, Company } from "@/features/alarm/alarm.types";
import { getSessionFn, logoutFn } from "@/features/auth/auth.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AlarmSettings | null>(null);
  const [logs, setLogs] = useState<AlarmLogEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const session = await getSessionFn();
        if (!session.authenticated) {
          navigate({ to: "/login" });
          return;
        }

        const state = await getAdminStateFn();
        setSettings(state.settings);
        setLogs(state.logs);
      } catch {
        navigate({ to: "/login" });
      }
    }

    void load();
  }, [navigate]);

  if (!settings) return null;

  const successCount = logs.filter((log) => log.status === "SUCCESS").length;
  const failedCount = logs.filter((log) => log.status === "FAILED").length;
  const latestLog = logs[0];

  function updateCompany(index: number, field: keyof Company, value: string) {
    const companies = [...settings.companies];
    companies[index] = { ...companies[index], [field]: value };
    setSettings({ ...settings, companies });
  }

  function removeCompany(index: number) {
    const companies = settings.companies.filter((_, itemIndex) => itemIndex !== index);
    setSettings({ ...settings, companies });
  }

  function addCompany() {
    setSettings({
      ...settings,
      companies: [...settings.companies, { id: "", name: "" }],
    });
  }

  async function saveSettings() {
    if (!settings.targetHost.trim() || !settings.targetPort.trim()) {
      toast.error("IP e porta sao obrigatorios.");
      return;
    }

    const seen = new Set<string>();
    for (const company of settings.companies) {
      if (!company.id.trim() || !company.name.trim()) {
        toast.error("Todas as empresas devem ter ID e nome.");
        return;
      }

      if (seen.has(company.id)) {
        toast.error(`ID duplicado: ${company.id}`);
        return;
      }

      seen.add(company.id);
    }

    setSaving(true);
    try {
      const saved = await saveAlarmSettingsFn({ data: settings });
      setSettings(saved);
      toast.success("Configuracoes salvas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await logoutFn();
    navigate({ to: "/login" });
  }

  async function reloadLogs() {
    const state = await getAdminStateFn();
    setLogs(state.logs);
  }

  async function clearLogs() {
    if (!confirm("Apagar todos os logs?")) return;

    await clearAlarmLogsFn();
    setLogs([]);
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Administracao
              </p>
              <h1 className="text-xl font-semibold">Painel do sistema</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Sucessos
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{successCount}</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Falhas
              </p>
              <p className="mt-2 text-3xl font-semibold text-destructive">{failedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Ultimo evento
              </p>
              <p className="mt-2 truncate text-lg font-semibold text-foreground">
                {latestLog
                  ? `${latestLog.command} / ${latestLog.client} / ${latestLog.status}`
                  : "Sem registros"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="config">Configuracoes</TabsTrigger>
            <TabsTrigger value="empresas">Empresas</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Logs de comandos</CardTitle>
                  <CardDescription>
                    Ultimos {logs.length} de no maximo 500 registros, incluindo acertos e falhas.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void reloadLogs()}>
                    <RefreshCw className="mr-1 h-4 w-4" /> Recarregar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void clearLogs()}>
                    <Trash2 className="mr-1 h-4 w-4" /> Limpar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data / Hora</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead>Comando</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>HTTP</TableHead>
                        <TableHead>Detalhe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                            Nenhum log registrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell>{log.operator}</TableCell>
                            <TableCell>
                              <Badge variant={log.command === "ARMAR" ? "default" : "secondary"}>
                                {log.command}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{log.client}</TableCell>
                            <TableCell>{log.companyName}</TableCell>
                            <TableCell>
                              <Badge variant={log.status === "SUCCESS" ? "outline" : "destructive"}>
                                {log.status === "SUCCESS" ? "Enviado" : "Falhou"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{log.httpStatus ?? "-"}</TableCell>
                            <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                              {log.errorMessage ?? log.url}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>Host/URL e porta do comando HTTP</CardTitle>
                <CardDescription>
                  Destino configurado: {settings.targetHost}:{settings.targetPort}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ip">Host ou URL</Label>
                    <Input
                      id="ip"
                      value={settings.targetHost}
                      onChange={(event) =>
                        setSettings({ ...settings, targetHost: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      value={settings.targetPort}
                      onChange={(event) =>
                        setSettings({ ...settings, targetPort: event.target.value })
                      }
                    />
                  </div>
                </div>
                <Button onClick={() => void saveSettings()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar configuracoes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="empresas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Empresas</CardTitle>
                  <CardDescription>
                    O ID e o valor do parametro <code>organization</code> da URL.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={addCompany}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.companies.map((company, index) => (
                  <div key={`${company.id}-${index}`} className="flex items-end gap-2">
                    <div className="w-24 space-y-2">
                      <Label>ID</Label>
                      <Input
                        value={company.id}
                        onChange={(event) => updateCompany(index, "id", event.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={company.name}
                        onChange={(event) => updateCompany(index, "name", event.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCompany(index)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={() => void saveSettings()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar empresas"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
