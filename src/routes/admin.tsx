import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft, LogOut, Plus, Trash2, RefreshCw } from "lucide-react";
import {
  clearLogs,
  getCreds,
  getLogs,
  getSettings,
  isAuthenticated,
  saveCreds,
  saveSettings,
  setAuthenticated,
  type Empresa,
  type LogEntry,
  type Settings,
} from "@/lib/alarmStorage";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [creds, setCreds] = useState({ username: "", password: "" });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    setSettings(getSettings());
    setLogs(getLogs());
    setCreds(getCreds());
  }, [navigate]);

  if (!settings) return null;

  const updateEmpresa = (idx: number, field: keyof Empresa, value: string) => {
    const empresas = [...settings.empresas];
    empresas[idx] = { ...empresas[idx], [field]: value };
    setSettings({ ...settings, empresas });
  };

  const removeEmpresa = (idx: number) => {
    const empresas = settings.empresas.filter((_, i) => i !== idx);
    setSettings({ ...settings, empresas });
  };

  const addEmpresa = () => {
    setSettings({
      ...settings,
      empresas: [...settings.empresas, { id: "", nome: "" }],
    });
  };

  const salvar = () => {
    if (!settings.ip.trim() || !settings.port.trim()) {
      toast.error("IP e porta são obrigatórios.");
      return;
    }
    const seen = new Set<string>();
    for (const e of settings.empresas) {
      if (!e.id.trim() || !e.nome.trim()) {
        toast.error("Todas as empresas devem ter ID e nome.");
        return;
      }
      if (seen.has(e.id)) {
        toast.error(`ID duplicado: ${e.id}`);
        return;
      }
      seen.add(e.id);
    }
    saveSettings(settings);
    toast.success("Configurações salvas.");
  };

  const salvarCreds = () => {
    if (!creds.username.trim() || !creds.password.trim()) {
      toast.error("Usuário e senha são obrigatórios.");
      return;
    }
    saveCreds(creds);
    toast.success("Credenciais atualizadas.");
  };

  const sair = () => {
    setAuthenticated(false);
    navigate({ to: "/" });
  };

  const recarregarLogs = () => setLogs(getLogs());

  const limparLogs = () => {
    if (confirm("Apagar todos os logs?")) {
      clearLogs();
      setLogs([]);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Toaster />
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold">Administrador</h1>
          </div>
          <Button variant="outline" size="sm" onClick={sair}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>

        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="empresas">Empresas</TabsTrigger>
            <TabsTrigger value="conta">Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Logs de comandos</CardTitle>
                  <CardDescription>
                    Últimos {logs.length} de no máximo 500 registros (os mais antigos são removidos).
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={recarregarLogs}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Recarregar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={limparLogs}>
                    <Trash2 className="h-4 w-4 mr-1" /> Limpar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data / Hora</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead>Comando</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Empresa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            Nenhum log registrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(l.timestamp).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell>{l.operator}</TableCell>
                            <TableCell>
                              <span
                                className={
                                  l.command === "ARMAR"
                                    ? "font-medium text-foreground"
                                    : "font-medium text-destructive"
                                }
                              >
                                {l.command}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono">{l.client}</TableCell>
                            <TableCell>{l.empresaNome}</TableCell>
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
                <CardTitle>IP e porta do comando HTTP</CardTitle>
                <CardDescription>
                  URL gerada: http://{settings.ip}:{settings.port}/api/v1/events?...
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip">IP</Label>
                    <Input
                      id="ip"
                      value={settings.ip}
                      onChange={(e) => setSettings({ ...settings, ip: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      value={settings.port}
                      onChange={(e) => setSettings({ ...settings, port: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={salvar}>Salvar configurações</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="empresas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Empresas</CardTitle>
                  <CardDescription>
                    O ID é o valor do parâmetro <code>organization</code> da URL.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={addEmpresa}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.empresas.map((e, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="w-24 space-y-2">
                      <Label>ID</Label>
                      <Input
                        value={e.id}
                        onChange={(ev) => updateEmpresa(idx, "id", ev.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={e.nome}
                        onChange={(ev) => updateEmpresa(idx, "nome", ev.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEmpresa(idx)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={salvar}>Salvar empresas</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conta">
            <Card>
              <CardHeader>
                <CardTitle>Credenciais do administrador</CardTitle>
                <CardDescription>
                  Armazenadas localmente no navegador. Não compartilhe este dispositivo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label htmlFor="u">Usuário</Label>
                  <Input
                    id="u"
                    value={creds.username}
                    onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p">Senha</Label>
                  <Input
                    id="p"
                    type="password"
                    value={creds.password}
                    onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                  />
                </div>
                <Button onClick={salvarCreds}>Atualizar credenciais</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}