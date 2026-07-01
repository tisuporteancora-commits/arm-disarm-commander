import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
          </Link>
          <p className="text-sm font-medium text-muted-foreground">Arm Disarm Commander</p>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[420px] border-primary/20 shadow-lg shadow-primary/10">
          <CardHeader className="space-y-4 pb-5 text-center">
            <div className="mx-auto">
              <img
                src="/logo-ancora.png"
                alt="Âncora Segurança Patrimonial"
                className="mx-auto h-24 w-auto"
              />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl">Acesso administrativo</CardTitle>
              <CardDescription>
                Entre para configurar a central e consultar os logs de comandos.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void onSubmit(event)} className="space-y-5">
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
              <Button className="h-11 w-full" type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
