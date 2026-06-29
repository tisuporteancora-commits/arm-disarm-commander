import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { getSessionFn, loginFn } from "@/features/auth/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login Administrador" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getSessionFn();
      if (session.authenticated) navigate({ to: "/" });
    }

    void load();
  }, [navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await loginFn({ data: { username, password } });

      if (result.authenticated) {
        navigate({ to: "/" });
        return;
      }

      toast.error("Usuario ou senha invalidos.");
    } catch {
      toast.error("Usuario ou senha invalidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <Toaster />
      <section className="hidden border-r bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary-foreground/15">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight">
            Acesso protegido para operacao de alarmes.
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-6 opacity-80">
          Sessao via cookie HttpOnly. As credenciais ficam no ambiente do servidor.
        </p>
      </section>

      <main className="flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm border-primary/20 shadow-lg shadow-primary/10">
          <CardHeader>
            <CardTitle>Acesso administrativo</CardTitle>
            <CardDescription>Use as credenciais configuradas no servidor.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user">Usuario</Label>
                <Input
                  id="user"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">Senha</Label>
                <Input
                  id="pass"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <Link to="/">
                  <Button type="button" variant="ghost" size="sm">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                  </Button>
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
