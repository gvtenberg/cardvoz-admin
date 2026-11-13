# CardVoz Admin — Guia de referência para pessoas e agentes de IA

Leia este arquivo antes de alterar o painel. Ele vale para qualquer pessoa do grupo e para qualquer ferramenta (Claude Code, Cursor, Copilot, Codex etc.). O `CLAUDE.md` só aponta para cá. Como rodar e publicar está no [`README.md`](README.md).

O painel é usado **só pela equipe** do CardVoz: números gerais, usuários (admin e exclusão) e baralhos compartilhados ("Baralhos prontos" do site).

---

## 1. Regras

1. **Só admin entra.** A API confere `IsAdmin` em toda rota `/api/admin/*`; o painel só guarda a sessão de quem é admin (`keepIfAdmin` em `src/lib/api.ts`). Não confie em checagem só do lado do painel.
2. **Tokens:** `accessToken` só em memória; `refreshToken` no `localStorage` (`cardvoz-admin.refreshToken`), renovado um por vez entre abas (`navigator.locks`). Nunca coloque token em URL, `console.log` ou mensagem de erro, e não use `dangerouslySetInnerHTML`.
3. **Site estático** (`output: "export"`): nada que dependa de servidor Next (rotas dinâmicas `[id]`, API routes, middleware). Dados variáveis vão na query string (`/baralhos/editar/?id=`).
4. **Visual livre.** O painel não é usado pelas pessoas cegas e com baixa visão, então não precisa seguir as cores, o contraste AAA nem os tokens do site (decisão da equipe, nov/2026). Mantenha o básico de acessibilidade: rótulos nos campos, `<dialog>` nativo, foco visível e erros com `role="alert"`.
5. **Commits sem atribuição a IA.** Sem `Co-Authored-By`, "Generated with…" ou menção a IA em commits e PRs.
6. **Push na `main` publica** (GitHub Actions + deploy hook do Render, se configurado). Nunca faça push direto na `main`: trabalhe numa branch e abra PR (seção 5).

## 2. O sistema (4 repositórios)

| Repositório | Papel |
|---|---|
| `cardvoz` | Site das pessoas que estudam (Next.js estático) |
| `cardvoz-api` | API REST em C# (.NET 9); o painel usa `/api/auth/*` e `/api/admin/*` |
| `cardvoz-db` | Esquema do banco (migrations do Supabase) |
| **`cardvoz-admin`** (este) | Painel da equipe (Next.js estático) |

- `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_GOOGLE_CLIENT_ID` são gravadas no build: mudou, gere o site de novo.
- A origem do painel precisa estar em `CORS_ALLOWED_ORIGINS` da API. Para o Google, `https://<painel>/entrar/` precisa estar cadastrado no cliente OAuth.
- **Baralhos compartilhados** não têm dono; cada pessoa adiciona uma cópia independente. Editar ou excluir o compartilhado não muda as cópias. O idioma das fichas vai junto na cópia.

## 3. Estrutura

```
src/app/            páginas: / (números), /entrar/, /usuarios/, /baralhos/ (+ editar/?id=)
src/app/Painel.tsx  menu lateral, "Pular para o conteúdo" e sessão; sem sessão de admin, manda para /entrar/.
                    registrarSaida(): página com mudanças sem salvar pergunta antes de o menu trocar de página
src/app/ErroCarregar.tsx  falha ao carregar + "Tentar de novo" (erro de ação fica à parte, só com a mensagem)
src/lib/api.ts      sessão e chamadas à API; sair numa aba sai em todas
src/lib/texto.ts    plural() e mensagemDeErro(), usados por todas as telas
src/lib/google.ts   entrar com Google (authorization code + PKCE, igual ao site)
src/lib/colarFichas.mjs  leitor de "Colar várias fichas" (npm test)
```

## 4. Convenções

- Interface, comentários, commits e documentação em **português do Brasil**.
- Commits no formato Conventional Commits (`feat:`, `fix:`, `docs:`).
- Comentários explicam o porquê, não o óbvio.
- Antes de concluir: `npx tsc --noEmit`, `npm test` e `npm run build` passando (o painel não tem ESLint).

## 5. Combinados da equipe

Estas regras vieram de conversas da equipe com assistentes de IA e valem para todo mundo, use ou não uma ferramenta de IA. Os `AGENTS.md` do `cardvoz`, da `cardvoz-api` e do `cardvoz-db` têm a mesma seção, adaptada a cada repositório.

- **Português do Brasil** em respostas, comentários, commits, PRs e documentação. Quando a pessoa disser que entendeu, siga para o próximo passo sem repetir a explicação.
- **Documentação em toda mudança:** README e este arquivo atualizados junto.
- **Trabalho dividido:** cada repositório tem dono no grupo (o original deste é do `fiuzaheitor`; a publicação é a partir do fork `gvtenberg/cardvoz-admin`). Mudança que exige rota nova na API ou coluna nova no banco começa por lá (`docs/tarefas/` da `cardvoz-api`); publique na ordem banco → API → painel.
- **Fluxo de branch e PR (vale para pessoas e para qualquer agente de IA):**
  - **Nunca faça push direto na `main`.** Commits numa branch (`feat/...`, `fix/...`, `docs/...`), push para o repositório de publicação e PR para a `main` dele. Quem faz o merge é uma pessoa da equipe, pelo PR.
  - **Repositórios de publicação (nov/2026):** site `gvtenberg/cardvoz` e API `gvtenberg/cardvoz-api` (o merge na `main` publica no Render); banco `gvtenberg/cardvoz-db` (a migration vai ao Supabase com `npx supabase db push --remote`, antes do merge da API que a usa); painel `gvtenberg/cardvoz-admin` (fork do `fiuzaheitor/cardvoz-admin`, criado em nov/2026 para publicar no Render). Os repositórios `fiuzaheitor/cardvoz-api` e `fiuzaheitor/cardvoz-db` são os originais: não abra PR neles sem combinar com o dono. Ao abrir PR a partir de um fork, confira o **base repository**: o GitHub sugere o original.
  - **Mudança que depende de outra:** um PR por repositório, na ordem **banco → API → site → painel**, e cada PR diz do que depende.
  - **Ao terminar** (resposta de um agente de IA, mensagem no grupo ou descrição do PR), informe sempre, no mesmo formato: (1) o que foi enviado, com repositório e branch; (2) os links dos PRs, numerados na ordem de merge; (3) o que cada merge publica; (4) o que precisa ser configurado ou feito à mão (migration, variáveis de ambiente, Google Cloud, Render). Sem a ferramenta `gh`, o link do PR é `https://github.com/<dono>/<repo>/compare/main...<branch>?expand=1` (dá para preencher `&title=` e `&body=`). A pessoa não deve precisar perguntar o que foi feito.
- **Problemas** viram issue no GitHub do repositório certo. O commit que corrige cita a issue (`Closes #10`).
- **Histórico (nov/2026):** entrar com Google no painel, idioma das fichas nos baralhos compartilhados e passe do site (0.2.0: "Abrir painel Admin" no Perfil entra sem login; `readAdminPass`/`loginWithAdminPass` em `src/lib/api.ts`).
