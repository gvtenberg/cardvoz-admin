"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getStats, type Stats } from "@/lib/api";
import { mensagemDeErro, plural } from "@/lib/texto";
import { useSession } from "./Painel";

/** Parte de um total em % (0 a 100); 0 quando não há total */
const porcento = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** Barra de proporção: decorativa, o texto ao lado já diz os números */
function Barra({ parte, total }: { parte: number; total: number }) {
  return (
    <span className="barra" aria-hidden="true">
      <span style={{ width: `${porcento(parte, total)}%` }} />
    </span>
  );
}

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

  // Números de estudo: a API de antes de nov/2026 não mandava (ficam em zero)
  const acertos = stats?.correctAnswers ?? 0;
  const erros = stats?.incorrectAnswers ?? 0;
  const respostas = acertos + erros;
  const ativos = stats?.activeLast7Days ?? 0;
  const confirmados = stats?.confirmedEmails ?? 0;

  return (
    <main id="conteudo">
      <div className="cabecalho">
        <div>
          <h1>Painel</h1>
          <p className="suave">Olá, {firstName}. Um resumo de como o CardVoz está sendo usado.</p>
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
          <div className="indicadores" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="cartao indicador">
                <span className="esqueleto" style={{ width: "55%", height: "1rem" }} />
                <span className="esqueleto" style={{ width: "30%", height: "2.25rem" }} />
                <span className="esqueleto" style={{ width: "70%", height: "1rem" }} />
              </div>
            ))}
          </div>
          <div className="colunas" aria-hidden="true">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="cartao">
                <span className="esqueleto" style={{ width: "35%", height: "1.25rem" }} />
                <span className="esqueleto" style={{ width: "100%", height: "7rem" }} />
              </div>
            ))}
          </div>
        </>
      )}

      {stats && (
        <>
          <dl className="indicadores">
            <div className="cartao indicador">
              <dt>Usuários</dt>
              <dd>
                <span className="indicador-valor">{stats.users}</span>
                <span className="indicador-extra">{plural(stats.admins, "admin", "admins")}</span>
              </dd>
            </div>
            <div className="cartao indicador">
              <dt>Estudaram na semana</dt>
              <dd>
                <span className="indicador-valor">{ativos}</span>
                <span className="indicador-extra">
                  de {plural(stats.users, "conta", "contas")}, nos últimos 7 dias
                </span>
              </dd>
            </div>
            <div className="cartao indicador">
              <dt>Respostas</dt>
              <dd>
                <span className="indicador-valor">{respostas}</span>
                <span className="indicador-extra">
                  {respostas > 0 ? `${porcento(acertos, respostas)}% de acerto` : "Ninguém respondeu ainda"}
                </span>
              </dd>
            </div>
            <div className="cartao indicador">
              <dt>Para revisar agora</dt>
              <dd>
                <span className="indicador-valor">{stats.cardsDueNow ?? 0}</span>
                <span className="indicador-extra">Fichas na data de revisão, em todas as contas</span>
              </dd>
            </div>
          </dl>

          <div className="colunas">
            <section className="cartao" aria-labelledby="estudo-titulo">
              <h2 id="estudo-titulo">Estudo</h2>
              <div className="medida">
                <p className="medida-topo">
                  <span>Acertos e erros</span>
                  <span className="medida-valor">{respostas > 0 ? `${porcento(acertos, respostas)}% de acerto` : "Sem respostas"}</span>
                </p>
                <span className="barra" aria-hidden="true">
                  {respostas > 0 && (
                    <>
                      <span className="barra-acertos" style={{ width: `${porcento(acertos, respostas)}%` }} />
                      <span className="barra-erros" style={{ flex: 1 }} />
                    </>
                  )}
                </span>
                <p className="legenda">
                  <span>{plural(acertos, "acerto", "acertos")}</span>
                  <span>{plural(erros, "erro", "erros")}</span>
                </p>
              </div>
              <div className="medida">
                <p className="medida-topo">
                  <span>Contas que estudaram na semana</span>
                  <span className="medida-valor">
                    {ativos} de {stats.users}
                  </span>
                </p>
                <Barra parte={ativos} total={stats.users} />
              </div>
              <div className="medida">
                <p className="medida-topo">
                  <span>E-mails confirmados</span>
                  <span className="medida-valor">
                    {confirmados} de {stats.users}
                  </span>
                </p>
                <Barra parte={confirmados} total={stats.users} />
              </div>
            </section>

            <section className="cartao" aria-labelledby="conteudo-titulo">
              <div className="cartao-topo">
                <h2 id="conteudo-titulo">Conteúdo</h2>
                <Link href="/baralhos/">Ver baralhos</Link>
              </div>
              <dl className="linhas">
                <div>
                  <dt>Baralhos compartilhados</dt>
                  <dd>{stats.sharedDecks}</dd>
                </div>
                <div>
                  <dt>Baralhos dos usuários</dt>
                  <dd>{stats.decks}</dd>
                </div>
                <div>
                  <dt>Fichas, em todos os baralhos</dt>
                  <dd>{stats.cards}</dd>
                </div>
                <div>
                  <dt>Sessões de estudo guardadas</dt>
                  <dd>{stats.studySessions}</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
