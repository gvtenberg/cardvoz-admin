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
6. **Push na `main` publica** (GitHub Actions + deploy hook do Render, se configurado). Trabalhe numa branch e abra PR.

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
src/app/Painel.tsx  menu lateral e sessão; sem sessão de admin, manda para /entrar/
src/lib/api.ts      sessão e chamadas à API
src/lib/google.ts   entrar com Google (authorization code + PKCE, igual ao site)
src/lib/colarFichas.mjs  leitor de "Colar várias fichas" (npm test)
```

## 4. Convenções

- Interface, comentários, commits e documentação em **português do Brasil**.
- Commits no formato Conventional Commits (`feat:`, `fix:`, `docs:`).
- Comentários explicam o porquê, não o óbvio.
- Antes de concluir: `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build` passando.

## 5. Combinados da equipe

Estas regras vieram de conversas da equipe com assistentes de IA e valem para todo mundo, use ou não uma ferramenta de IA. Os `AGENTS.md` do `cardvoz`, da `cardvoz-api` e do `cardvoz-db` têm a mesma seção, adaptada a cada repositório.

- **Português do Brasil** em respostas, comentários, commits, PRs e documentação. Quando a pessoa disser que entendeu, siga para o próximo passo sem repetir a explicação.
- **Documentação em toda mudança:** README e este arquivo atualizados junto.
- **Trabalho dividido:** cada repositório tem dono no grupo (este é do `fiuzaheitor`). Mudança que exige rota nova na API ou coluna nova no banco começa por lá (`docs/tarefas/` da `cardvoz-api`); publique na ordem banco → API → painel.
- **Problemas** viram issue no GitHub do repositório certo. O commit que corrige cita a issue (`Closes #10`).
- **Histórico (nov/2026):** entrar com Google no painel e idioma das fichas nos baralhos compartilhados.
