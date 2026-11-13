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
  /** Números de estudo (API de nov/2026; ausentes na API antiga) */
  correctAnswers?: number;
  incorrectAnswers?: number;
  cardsDueNow?: number;
  activeLast7Days?: number;
  confirmedEmails?: number;
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
// Muda a cada "Sair": uma renovação que termina depois não grava a sessão de volta
let sessionEpoch = 0;

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
 * Lê o passe que o site do CardVoz põe no endereço (/entrar/#passe=...) ao tocar em
 * "Abrir painel Admin". Fica depois do #, então não vai a servidor nenhum.
 */
export function readAdminPass(hash: string): string | null {
  const code = new URLSearchParams(hash.replace(/^#/, "")).get("passe");
  return code && code.length <= 100 ? code : null;
}

/**
 * Troca o passe (uso único, 1 minuto) por uma sessão nova do painel, sem pedir
 * login. Uma sessão antiga deste navegador é encerrada: o passe pode ser de outra conta.
 */
export async function loginWithAdminPass(code: string): Promise<User> {
  const response = await send("/auth/admin-pass/redeem", { method: "POST", body: JSON.stringify({ code }) });
  if (!response.ok) throw await toError(response);
  const auth: AuthResponse = await response.json();
  const previous = getRefreshToken();
  if (previous && previous !== auth.refreshToken) {
    send("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: previous }) }).catch(() => {});
  }
  // Uma renovação da sessão antiga que termine depois não grava por cima desta
  sessionEpoch++;
  const user = keepIfAdmin(auth);
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
  const epoch = sessionEpoch;
  // Lido dentro da trava: se outra aba renovou enquanto esperávamos, usa o token novo dela
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const response = await send("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
  // A pessoa saiu enquanto a renovação esperava a resposta: não traz a sessão de volta
  if (epoch !== sessionEpoch) return null;
  if (response.status === 400 || response.status === 401) {
    forget();
    return null;
  }
  if (!response.ok) throw await toError(response);
  const auth: AuthResponse = await response.json();
  if (epoch !== sessionEpoch) return null;
  return keepIfAdmin(auth);
}

/** Avisa quando outra aba saiu do painel (o refreshToken some do localStorage). */
export function onLogoutElsewhere(callback: () => void): () => void {
  const listener = (e: StorageEvent) => {
    if (e.key === REFRESH_KEY && e.newValue === null) {
      accessToken = null;
      sessionEpoch++;
      callback();
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function logout() {
  sessionEpoch++;
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
