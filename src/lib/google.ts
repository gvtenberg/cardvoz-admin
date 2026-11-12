/**
 * Entrar no painel com o Google: fluxo "authorization code + PKCE" com
 * redirecionamento, o mesmo do site do CardVoz (src/lib/auth/google.ts de lá).
 *
 * 1. startGoogleLogin gera `state` e o verificador PKCE, guarda na aba e vai ao Google.
 * 2. O Google volta para /entrar/?code=...&state=...
 * 3. readGoogleCallback confere o `state`; o código vai para a API (POST /auth/google),
 *    que guarda o segredo do cliente. Só entra quem tem isAdmin.
 *
 * O endereço https://<painel>/entrar/ precisa estar cadastrado no cliente OAuth do
 * Google, e a origem do painel em CORS_ALLOWED_ORIGINS da API.
 */

const PENDING_KEY = "cardvoz-admin.googleLogin";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

interface PendingLogin {
  state: string;
  verifier: string;
}

export function getGoogleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
}

/** Sem o ID do cliente no build, o botão do Google não aparece. */
export const isGoogleConfigured = () => Boolean(getGoogleClientId());

export function getGoogleRedirectUri(): string {
  return `${window.location.origin}/entrar/`;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const randomString = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

export async function startGoogleLogin() {
  const pending: PendingLogin = { state: randomString(), verifier: randomString() };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pending.verifier));
  // sessionStorage: vale só nesta aba e some ao fechá-la
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: pending.state,
    code_challenge: base64Url(new Uint8Array(digest)),
    code_challenge_method: "S256",
    prompt: "select_account",
    hl: "pt-BR",
  });
  window.location.assign(`${AUTH_ENDPOINT}?${params}`);
}

export type GoogleCallback = { kind: "ok"; code: string; verifier: string } | { kind: "error"; message: string };

function takePending(): PendingLogin | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingLogin) : null;
  } catch {
    return null;
  }
}

/** Interpreta a volta do Google (code/state ou error na URL de /entrar/). */
export function readGoogleCallback(params: URLSearchParams): GoogleCallback | null {
  const code = params.get("code");
  const error = params.get("error");
  if (!code && !error) return null;
  const pending = takePending();
  if (error) {
    return {
      kind: "error",
      message:
        error === "access_denied"
          ? "A entrada com o Google foi cancelada."
          : "O Google não concluiu a entrada. Tente de novo.",
    };
  }
  // O state impede que alguém faça você entrar na conta dele com um link preparado
  if (!pending || pending.state !== params.get("state")) {
    return { kind: "error", message: "Não foi possível confirmar a entrada. Tente de novo." };
  }
  return { kind: "ok", code: code!, verifier: pending.verifier };
}
