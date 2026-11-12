"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteUser, formatDate, getUsers, setAdmin, type AdminUser } from "@/lib/api";
import { mensagemDeErro, plural } from "@/lib/texto";
import { useConfirmar } from "../Confirmar";
import { ErroCarregar } from "../ErroCarregar";
import { useSession } from "../Painel";

const message = (e: unknown) => mensagemDeErro(e, "Algo deu errado. Tente de novo.");
// Busca sem diferença de maiúsculas e acentos ("elida" acha "Élida")
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function UsuariosPage() {
  const { user: me } = useSession();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  // Falha ao carregar (com "Tentar de novo") e falha de uma ação (só a mensagem:
  // "Tentar de novo" recarregaria a lista, não repetiria a ação)
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);
  const [confirmar, dialogo] = useConfirmar();

  const load = useCallback(() => {
    setError("");
    getUsers().then(setUsers).catch((e) => setError(message(e)));
  }, []);

  useEffect(load, [load]);

  /** Devolve se deu certo. */
  const run = async (target: AdminUser, action: () => Promise<void>, done: string) => {
    setBusyId(target.id);
    setActionError("");
    setStatus("");
    try {
      await action();
      setStatus(done);
      load();
      return true;
    } catch (e) {
      setActionError(message(e));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const toggleAdmin = async (u: AdminUser) => {
    if (busyId) return;
    const ok = await confirmar(
      u.isAdmin
        ? {
            titulo: `Tirar o admin de ${u.name}?`,
            mensagem: "Essa pessoa deixa de entrar no painel na hora. A conta e os baralhos dela continuam.",
            confirmar: "Tirar admin",
          }
        : {
            titulo: `Tornar ${u.name} admin?`,
            mensagem: "Essa pessoa vai poder entrar no painel, gerenciar usuários e criar baralhos compartilhados.",
            confirmar: "Tornar admin",
          }
    );
    if (!ok) return;
    await run(u, () => setAdmin(u.id, !u.isAdmin), u.isAdmin ? `${u.name} não é mais admin.` : `${u.name} agora é admin.`);
  };

  const remove = async (u: AdminUser) => {
    if (busyId) return;
    const ok = await confirmar({
      titulo: `Excluir a conta de ${u.name}?`,
      mensagem: `${u.email}. A conta, ${plural(u.deckCount, "baralho", "baralhos")} e o histórico de estudo serão apagados. Isso não pode ser desfeito.`,
      confirmar: "Excluir conta",
      perigo: true,
    });
    if (!ok) return;
    // O cartão (e o botão que tinha o foco) sumiu: o foco volta para a busca.
    // Se falhou, o cartão continua e o foco fica nele
    if (await run(u, () => deleteUser(u.id), `Conta de ${u.name} excluída.`)) buscaRef.current?.focus();
  };

  const termo = normalizar(query.trim());
  const visiveis = users?.filter((u) => normalizar(`${u.name} ${u.email}`).includes(termo)) ?? [];
  const admins = users?.filter((u) => u.isAdmin).length ?? 0;

  return (
    <main id="conteudo">
      <div className="cabecalho">
        <div>
          <h1>Usuários</h1>
          {users && (
            <p className="suave">
              {plural(users.length, "conta", "contas")} · {plural(admins, "admin", "admins")}
            </p>
          )}
        </div>
      </div>

      <p role="status" className={status ? "sucesso" : "sr-only"}>
        {status}
      </p>
      {actionError && (
        <p role="alert" className="erro">
          {actionError}
        </p>
      )}
      {error && <ErroCarregar mensagem={error} onTentar={load} />}

      {!users && !error && (
        <>
          <p role="status" className="sr-only">
            Carregando usuários...
          </p>
          <div className="lista" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="cartao pessoa">
                <span className="esqueleto avatar" />
                <div className="pessoa-info">
                  <span className="esqueleto" style={{ width: "40%", height: "1.5rem" }} />
                  <span className="esqueleto" style={{ width: "60%", height: "1.25rem" }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {users && (
        <>
          <label className="campo busca">
            Buscar
            <input
              ref={buscaRef}
              type="search"
              placeholder="Nome ou e-mail"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {termo && (
            <p role="status" className="suave">
              {visiveis.length === 0
                ? "Nenhuma conta encontrada."
                : `${plural(visiveis.length, "conta encontrada", "contas encontradas")}.`}
            </p>
          )}

          <ul className="lista">
            {visiveis.map((u) => {
              const sou = u.id === me?.id;
              const ocupado = busyId === u.id || undefined;
              return (
                <li key={u.id} className="cartao pessoa">
                  <span className="avatar" aria-hidden="true">
                    {u.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="pessoa-info">
                    <h2 className="pessoa-nome">
                      {u.name}
                      {sou && " (você)"}
                    </h2>
                    <p className="pessoa-email">{u.email}</p>
                    <p className="selos">
                      {u.isAdmin && <span className="selo selo-admin">Admin</span>}
                      <span className="sr-only">Entra com</span>
                      {u.hasPassword && <span className="selo">Senha</span>}
                      {u.hasGoogle && <span className="selo">Google</span>}
                    </p>
                    <p className="suave">
                      {plural(u.deckCount, "baralho", "baralhos")} · conta criada em {formatDate(u.createdAt)}
                    </p>
                  </div>
                  {!sou && (
                    <div className="pessoa-acoes">
                      <button
                        type="button"
                        className="secundario"
                        aria-disabled={ocupado}
                        onClick={() => toggleAdmin(u)}
                        aria-label={`${u.isAdmin ? "Tirar admin" : "Tornar admin"}: ${u.name}`}
                      >
                        {u.isAdmin ? "Tirar admin" : "Tornar admin"}
                      </button>
                      <button
                        type="button"
                        className="perigo"
                        aria-disabled={ocupado}
                        onClick={() => remove(u)}
                        aria-label={`Excluir conta: ${u.name}`}
                      >
                        Excluir conta
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {dialogo}
    </main>
  );
}
