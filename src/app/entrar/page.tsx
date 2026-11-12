"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, login, loginWithGoogle, restoreSession } from "@/lib/api";
import { getGoogleRedirectUri, isGoogleConfigured, readGoogleCallback, startGoogleLogin } from "@/lib/google";
import { Logo } from "../Logo";
import { useSession } from "../Painel";

export default function EntrarPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Volta do Google (?code=&state= ou ?error=): troca o código e limpa a URL
  useEffect(() => {
    const callback = readGoogleCallback(new URLSearchParams(window.location.search));
    if (!callback) return;
    window.history.replaceState(null, "", "/entrar/");
    if (callback.kind === "error") {
      setError(callback.message);
      return;
    }
    setSending(true);
    loginWithGoogle(callback.code, callback.verifier, getGoogleRedirectUri())
      .then((user) => {
        setUser(user);
        router.replace("/");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível entrar com o Google. Tente de novo.");
        setSending(false);
      });
  }, [router, setUser]);

  // Já tem sessão de admin neste navegador: vai direto ao painel
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("code")) return;
    restoreSession()
      .then((user) => {
        if (user) {
          setUser(user);
          router.replace("/");
        }
      })
      .catch(() => {});
  }, [router, setUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!email.trim() || !password) {
      setError("Escreva seu e-mail e sua senha.");
      emailRef.current?.focus();
      return;
    }
    setSending(true);
    setError("");
    try {
      setUser(await login(email.trim(), password));
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.");
      setSending(false);
    }
  };

  return (
    <main id="conteudo" className="estreito">
      <div className="marca">
        <Logo tamanho={48} />
        <span>CardVoz</span>
        <span className="selo selo-admin">Admin</span>
      </div>
      <div className="cabecalho">
        <div>
          <h1>Entrar no painel</h1>
          <p className="suave">
            Use a sua conta do CardVoz (e-mail e senha{isGoogleConfigured() ? " ou Google" : ""}). Só
            contas de admin têm acesso.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="erro">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate className="cartao">
        <label className="campo">
          E-mail
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="campo">
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" aria-disabled={sending || undefined}>
          {sending ? "Entrando..." : "Entrar"}
        </button>
        {isGoogleConfigured() && (
          <button
            type="button"
            className="secundario"
            aria-disabled={sending || undefined}
            onClick={() => {
              if (sending) return;
              setError("");
              startGoogleLogin().catch(() => setError("Não foi possível abrir o Google. Tente de novo."));
            }}
          >
            Entrar com Google
          </button>
        )}
      </form>
    </main>
  );
}
