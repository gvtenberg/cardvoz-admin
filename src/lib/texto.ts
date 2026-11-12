import { ApiError } from "@/lib/api";

/** "1 ficha", "3 fichas" */
export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Mensagem da API (ela já explica o problema em português) ou o texto padrão da tela. */
export const mensagemDeErro = (e: unknown, padrao: string) => (e instanceof ApiError ? e.message : padrao);
