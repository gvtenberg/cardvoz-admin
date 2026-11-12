"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getStats, type Stats } from "@/lib/api";
import { mensagemDeErro, plural } from "@/lib/texto";
import { useSession } from "./Painel";

/** " (75% de acerto)", ou nada sem respostas */
const aproveitamento = (acertos: number, erros: number) =>
  acertos + erros > 0 ? ` (${Math.round((acertos / (acertos + erros)) * 100)}% de acerto)` : "";

export default function PainelPage() {
  const { user } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    getStats()
      .then(setStats)
      .catch((e) => setError(mensagemDeErro(e, "Não foi possível carregar os números.")));
  }, []);

  useEffect(load, [load]);

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <main id="conteudo">
      <div className="cabecalho">
        <div>
          <h1>Olá, {firstName}</h1>
          <p className="suave">Um resumo de como o CardVoz está sendo usado.</p>
        </div>
        <Link href="/baralhos/editar/" className="botao">
          Novo baralho compartilhado
        </Link>
      </div>

      {error && (
        <div className="cartao">
          <p role="alert" className="erro">
            {error}
          </p>
          <div className="acoes">
            <button type="button" onClick={load}>
              Tentar de novo
            </button>
          </div>
        </div>
      )}

      {!stats && !error && (
        <>
          <p role="status" className="sr-only">
            Carregando os números...
          </p>
          <div className="numeros" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="cartao numero">
                <span className="esqueleto" style={{ width: "60%", height: "1.25rem" }} />
                <span className="esqueleto" style={{ width: "35%", height: "2.75rem" }} />
              </div>
            ))}
          </div>
        </>
      )}

      {stats && (
        <dl className="numeros">
          <div className="cartao numero">
            <dt>Usuários</dt>
            <dd>
              <span className="numero-valor">{stats.users}</span>
              <span className="numero-extra">{plural(stats.admins, "admin", "admins")}</span>
              <Link href="/usuarios/">Ver usuários</Link>
            </dd>
          </div>
          <div className="cartao numero">
            <dt>Baralhos compartilhados</dt>
            <dd>
              <span className="numero-valor">{stats.sharedDecks}</span>
              <span className="numero-extra">Em &ldquo;Baralhos prontos&rdquo; no site</span>
              <Link href="/baralhos/">Ver baralhos compartilhados</Link>
            </dd>
          </div>
          <div className="cartao numero">
            <dt>Baralhos dos usuários</dt>
            <dd>
              <span className="numero-valor">{stats.decks}</span>
              <span className="numero-extra">Criados ou copiados por quem usa</span>
            </dd>
          </div>
          <div className="cartao numero">
            <dt>Fichas</dt>
            <dd>
              <span className="numero-valor">{stats.cards}</span>
              <span className="numero-extra">Em todos os baralhos</span>
            </dd>
          </div>
          <div className="cartao numero">
            <dt>Sessões de estudo</dt>
            <dd>
              <span className="numero-valor">{stats.studySessions}</span>
              <span className="numero-extra">Rodadas guardadas nas contas</span>
            </dd>
          </div>
          {stats.correctAnswers !== undefined && (
            <>
              <div className="cartao numero">
                <dt>Respostas</dt>
                <dd>
                  <span className="numero-valor">{(stats.correctAnswers ?? 0) + (stats.incorrectAnswers ?? 0)}</span>
                  <span className="numero-extra">
                    {plural(stats.correctAnswers ?? 0, "acerto", "acertos")} e{" "}
                    {plural(stats.incorrectAnswers ?? 0, "erro", "erros")}
                    {aproveitamento(stats.correctAnswers ?? 0, stats.incorrectAnswers ?? 0)}
                  </span>
                </dd>
              </div>
              <div className="cartao numero">
                <dt>Para revisar agora</dt>
                <dd>
                  <span className="numero-valor">{stats.cardsDueNow ?? 0}</span>
                  <span className="numero-extra">Fichas na data de revisão, em todas as contas</span>
                </dd>
              </div>
              <div className="cartao numero">
                <dt>Estudaram na semana</dt>
                <dd>
                  <span className="numero-valor">{stats.activeLast7Days ?? 0}</span>
                  <span className="numero-extra">Pessoas que estudaram nos últimos 7 dias</span>
                </dd>
              </div>
              <div className="cartao numero">
                <dt>E-mails confirmados</dt>
                <dd>
                  <span className="numero-valor">{stats.confirmedEmails ?? 0}</span>
                  <span className="numero-extra">De {plural(stats.users, "conta", "contas")}</span>
                </dd>
              </div>
            </>
          )}
        </dl>
      )}
    </main>
  );
}
