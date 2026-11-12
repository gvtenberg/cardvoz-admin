# CardVoz Admin

Painel da equipe do [CardVoz](https://github.com/gvtenberg/cardvoz) para:

- ver os números gerais (usuários, baralhos, fichas, sessões de estudo);
- gerenciar usuários: ver quem entra com senha ou Google, dar e tirar o acesso de admin, excluir contas;
- criar, editar e excluir **baralhos compartilhados**, que aparecem em "Baralhos prontos" no CardVoz. Cada pessoa adiciona uma cópia aos próprios baralhos; mudar ou excluir o compartilhado não altera as cópias já feitas.
  No editor, "Idioma das perguntas" e "Idioma das respostas" (ex.: um baralho de inglês) fazem o leitor de tela de quem copiar pronunciar no idioma certo. "Colar várias fichas" aceita uma lista (uma ficha por linha, `pergunta; resposta`) ou duas colunas copiadas de uma planilha.

É um site estático em Next.js (pasta `out/`) que chama a [cardvoz-api](https://github.com/fiuzaheitor/cardvoz-api) pelo navegador, nas rotas `/api/admin/*`.

## Quem pode entrar

Só contas do CardVoz com `IsAdmin`, entrando com **e-mail e senha** ou com **Google**. A API confere o admin em toda chamada, então tirar o acesso vale na hora.

**Google no painel:** gere o build com `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (o mesmo ID do site), cadastre `https://<painel>/entrar/` (e `http://localhost:3001/entrar/` para testar) em "URIs de redirecionamento autorizados" do cliente OAuth no Google Cloud, e confira se a origem do painel está em `CORS_ALLOWED_ORIGINS` da API (a API só aceita voltar para `/entrar/` de origens liberadas). Sem a variável, o botão não aparece.

O primeiro admin é definido no Supabase (veja o README do [cardvoz-db](https://github.com/fiuzaheitor/cardvoz-db), seção "Primeiro admin do painel"). Os seguintes, na página **Usuários** do painel. Ninguém tira o próprio acesso nem exclui a própria conta pelo painel.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run dev                  # http://localhost:3001
npm test                     # testes do leitor de "Colar várias fichas"
```

A `cardvoz-api` precisa estar rodando e liberar `http://localhost:3001` em `CORS_ALLOWED_ORIGINS`.

## Publicar no Render

1. **New → Static Site**, ligado a este repositório.
   - Build command: `npm ci && npm run build`
   - Publish directory: `out`
   - Variável: `NEXT_PUBLIC_API_URL=https://<api>.onrender.com/api` (gravada no build: mudou, refaça o deploy)
   - Opcional: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` para o botão "Entrar com Google"
2. Na API, acrescente o endereço do painel em `CORS_ALLOWED_ORIGINS` (separado por vírgula, sem barra no final).
3. Opcional: copie o deploy hook do site no Render para o secret `RENDER_DEPLOY_HOOK_URL` deste repositório. Assim, cada push na `main` publica o painel depois do build passar.

## Estrutura

```
src/
├── app/
│   ├── layout.tsx            # Página base com o Painel (cabeçalho e proteção)
│   ├── Painel.tsx            # Menu lateral (no celular, botão "Menu") e sessão de admin; sem ela, manda para /entrar/
│   ├── page.tsx              # /            Números gerais
│   ├── entrar/               # /entrar/     Login (e-mail e senha)
│   ├── usuarios/             # /usuarios/   Contas, admin e exclusão
│   └── baralhos/             # /baralhos/   Baralhos compartilhados (+ editar/?id=)
└── lib/api.ts                # Sessão (token em memória, renovação no 401) e chamadas à API
```
