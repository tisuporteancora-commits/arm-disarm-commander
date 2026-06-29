import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";
import { getCreds, isAuthenticated, setAuthenticated } from "@/lib/alarmStorage";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login Administrador" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthenticated()) navigate({ to: "/admin" });
  }, [navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const creds = getCreds();
    if (username === creds.username && password === creds.password) {
      setAuthenticated(true);
      navigate({ to: "/admin" });
    } else {
      toast.error("Usuário ou senha inválidos.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Toaster />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Acesso Administrador</CardTitle>
          <CardDescription>Padrão: admin / admin (altere depois de entrar).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Usuário</Label>
              <Input id="user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass">Senha</Label>
              <Input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              <Link to="/">
                <Button type="button" variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              </Link>
              <Button type="submit">Entrar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}