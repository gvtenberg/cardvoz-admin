/**
 * Chamadas à cardvoz-api e sessão do painel. Mesmo esquema do site do CardVoz:
 * accessToken só em memória; refreshToken no localStorage, trocado no 401.
 * Só entra quem tem isAdmin; a API confere de novo em toda rota /admin.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
const REFRESH_KEY = "cardvoz-admin.refreshToken";

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface Stats {
  users: number;
  admins: number;
  decks: number;
  sharedDecks: number;
  cards: number;
  studySessions: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  deckCount: number;
  createdAt: string;
}

export interface Deck {
  id: string;
  title: string;
  description?: string | null;
  cardCount: number;
  createdAt: string;
  updatedAt?: string | null;
  /** Idioma das perguntas e das respostas (ex.: "en"); ausente = português */
  questionLanguage?: string | null;
  answerLanguage?: string | null;
}

export interface CardInput {
  question: string;
  answer: string;
}

export interface DeckDetail extends Deck {
  cards: CardInput[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<User | null> | null = null;

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Não foi possível falar com a API. Confira a internet e tente de novo.");
  }
}

/** Mensagem da API (campo "message" ou primeiro erro de validação) ou uma padrão. */
async function toError(response: Response): Promise<ApiError> {
  let message = response.status === 403 ? "Sua conta não é de admin." : "Algo deu errado. Tente de novo.";
  try {
    const body = await response.json();
    if (typeof body?.message === "string") message = body.message;
    else if (body?.errors) message = (Object.values(body.errors).flat()[0] as string) ?? message;
  } catch {
    // resposta sem corpo
  }
  return new ApiError(response.status, message);
}

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function forget() {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {}
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** Guarda a sessão se a conta for admin; senão, encerra a sessão recém-criada. */
function keepIfAdmin(auth: AuthResponse): User | null {
  if (!auth.user.isAdmin) {
    accessToken = null;
    send("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: auth.refreshToken }) }).catch(() => {});
    forget();
    return null;
  }
  accessToken = auth.accessToken;
  try {
    localStorage.setItem(REFRESH_KEY, auth.refreshToken);
  } catch {}
  return auth.user;
}

export async function login(email: string, password: string): Promise<User> {
  const response = await send("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!response.ok) throw await toError(response);
  const user = keepIfAdmin(await response.json());
  if (!user) throw new ApiError(403, "Esta conta não é de admin. Peça acesso a outra pessoa da equipe.");
  return user;
}

/** Troca o código da volta do Google pelos tokens da API; só guarda a sessão se for admin. */
export async function loginWithGoogle(code: string, codeVerifier: string, redirectUri: string): Promise<User> {
  const response = await send("/auth/google", {
    method: "POST",
    body: JSON.stringify({ code, codeVerifier, redirectUri }),
  });
  if (!response.ok) throw await toError(response);
  const user = keepIfAdmin(await response.json());
  if (!user) throw new ApiError(403, "Esta conta não é de admin. Peça acesso a outra pessoa da equipe.");
  return user;
}

/**
 * Restaura ou renova a sessão. Uma renovação por vez, inclusive entre abas
 * (navigator.locks): repetir o mesmo refreshToken faz a API recusar o segundo
 * pedido, e a aba recusada apagaria o token novo que a outra acabou de gravar.
 * Devolve null se não houver sessão de admin; lança ApiError se a API não respondeu.
 */
export function restoreSession(): Promise<User | null> {
  return (refreshing ??= (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.locks) {
        return await navigator.locks.request("cardvoz-admin-refresh", renew);
      }
      return await renew();
    } finally {
      refreshing = null;
    }
  })());
}

async function renew(): Promise<User | null> {
  // Lido dentro da trava: se outra aba renovou enquanto esperávamos, usa o token novo dela
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const response = await send("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
  if (response.status === 400 || response.status === 401) {
    forget();
    return null;
  }
  if (!response.ok) throw await toError(response);
  return keepIfAdmin(await response.json());
}

export function logout() {
  const refreshToken = getRefreshToken();
  forget();
  if (refreshToken) {
    void fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    }).catch(() => {});
  }
}

async function api<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
  const response = await send(path, init);
  if (response.status === 401) {
    if (canRetry && (await restoreSession())) return api<T>(path, init, false);
    // Sessão acabou de vez (inclusive conta excluída): volta para a tela de entrar.
    // A promessa nunca termina para a página não mostrar um erro enquanto sai.
    forget();
    window.location.assign("/entrar/");
    return new Promise<T>(() => {});
  }
  if (!response.ok) throw await toError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const getStats = () => api<Stats>("/admin/stats");
export const getUsers = () => api<AdminUser[]>("/admin/users");
export const setAdmin = (id: string, isAdmin: boolean) =>
  api<void>(`/admin/users/${id}/admin`, { method: "PUT", body: JSON.stringify({ isAdmin }) });
export const deleteUser = (id: string) => api<void>(`/admin/users/${id}`, { method: "DELETE" });

export const getSharedDecks = () => api<Deck[]>("/admin/shared-decks");
export const getSharedDeck = (id: string) => api<DeckDetail>(`/admin/shared-decks/${id}`);
/** Cria (sem id) ou substitui título, descrição e fichas (com id). */
export const saveSharedDeck = (
  id: string | null,
  data: { title: string; description: string; questionLanguage: string; answerLanguage: string; cards: CardInput[] }
) =>
  api<Deck>(id ? `/admin/shared-decks/${id}` : "/admin/shared-decks", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(data),
  });
export const deleteSharedDeck = (id: string) => api<void>(`/admin/shared-decks/${id}`, { method: "DELETE" });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
