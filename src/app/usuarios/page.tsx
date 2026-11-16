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
          <div className="cartao tabela" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="linha">
                <div className="linha-quem">
                  <span className="esqueleto avatar" />
                  <div className="linha-texto" style={{ flex: 1 }}>
                    <span className="esqueleto" style={{ width: "40%", height: "1.125rem" }} />
                    <span className="esqueleto" style={{ width: "60%", height: "1rem" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {users && (
        <div className="cartao tabela tabela-pessoas">
          <div className="tabela-topo">
            <input
              ref={buscaRef}
              type="search"
              className="busca"
              aria-label="Buscar por nome ou e-mail"
              placeholder="Buscar por nome ou e-mail"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <p role="status" className="suave">
              {termo
                ? visiveis.length === 0
                  ? "Nenhuma conta encontrada."
                  : `${plural(visiveis.length, "conta encontrada", "contas encontradas")}.`
                : ""}
            </p>
          </div>
          {/* Só visual: cada linha já diz o que é cada dado para o leitor de tela */}
          <div className="tabela-cabeca" aria-hidden="true">
            <span>Usuário</span>
            <span>Entra com</span>
            <span>Baralhos</span>
            <span>Criada em</span>
            <span />
          </div>
          <ul className="tabela-linhas">
            {visiveis.map((u) => {
              const sou = u.id === me?.id;
              const ocupado = busyId === u.id || undefined;
              return (
                <li key={u.id} className="linha">
                  <div className="linha-quem">
                    <span className="avatar" aria-hidden="true">
                      {u.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className="linha-texto">
                      <h2 className="linha-nome">
                        {u.name}
                        {sou && " (você)"}
                        {u.isAdmin && <span className="selo selo-admin">Admin</span>}
                      </h2>
                      <p className="linha-sub">{u.email}</p>
                    </div>
                  </div>
                  <p className="selos">
                    <span className="sr-only">Entra com</span>
                    {u.hasPassword && <span className="selo">Senha</span>}
                    {u.hasGoogle && <span className="selo">Google</span>}
                  </p>
                  <p className="linha-dado">{plural(u.deckCount, "baralho", "baralhos")}</p>
                  <p className="linha-dado">
                    <span className="rotulo-celular">Conta criada em </span>
                    {formatDate(u.createdAt)}
                  </p>
                  <div className="linha-acoes">
                    {!sou && (
                      <>
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
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {dialogo}
    </main>
  );
}
