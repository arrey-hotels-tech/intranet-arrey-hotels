# Intranet Arrey Hotels — Fase 1

App Next.js (App Router) implementando a Fase 1 do PRD: home aberta, formulário público de chamado, kanban com 3 níveis de acesso (admin, gestor, diretoria), login por CPF + código no Telegram, notificação de novas demandas no Telegram.

## 1. Criar o projeto no Supabase

1. Crie um projeto novo e gratuito em supabase.com.
2. Vá em **SQL Editor** e rode o conteúdo de `supabase/schema.sql`.
   - O `insert into workspaces` está separado do resto porque o SQL Editor não guarda variáveis entre execuções: rode ele primeiro, copie o `id` retornado, e substitua `:workspace_id` no resto do arquivo por esse valor antes de rodar.
   - A seção de seed dos gestores está comentada — falta CPF e data de nascimento reais de cada um (só coloquei placeholder). Preencha e descomente quando tiver esses dados, ou cadastre pelo painel depois (`/painel/pessoas`).
3. Em **Project Settings → API**, copie: `Project URL`, `anon public key` e `service_role key`.

## 2. Criar a conta de admin (Márcio)

No Supabase, vá em **Authentication → Users → Add user** e crie o usuário com seu e-mail e uma senha. Esse é o login que você vai usar em `/login` (aba "Admin").

## 3. Criar o bot no Telegram

1. Fale com **@BotFather** no Telegram, `/newbot`, escolha um nome e um @username (ex: `arreyhotels_bot`).
2. Guarde o **token** que ele te dá.
3. Descubra o seu `chat_id` (pra receber as notificações de chamado): fale com o bot, depois acesse `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador e veja o campo `chat.id` da sua mensagem.

## 4. Variáveis de ambiente

Copie `.env.example` para `.env.local` (uso local) e preencha. Na Vercel, essas mesmas variáveis vão em **Project Settings → Environment Variables**.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEFAULT_WORKSPACE_ID=            # o id do workspace "Arrey Hotels" criado no passo 1
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=           # sem o @, ex: arreyhotels_bot
TELEGRAM_CHAT_ID=                # seu chat_id, pra receber as notificações
TELEGRAM_WEBHOOK_SECRET=         # qualquer string aleatória longa, você escolhe
SESSION_JWT_SECRET=              # qualquer string aleatória longa, você escolhe
```

## 5. Deploy na Vercel (sem domínio próprio ainda)

1. Suba esta pasta para um repositório no GitHub.
2. Em vercel.com, **Add New → Project**, importe o repositório.
3. Cole todas as variáveis de ambiente do passo 4.
4. Deploy. A Vercel gera uma URL gratuita tipo `intranet-arrey-hotels.vercel.app` — não precisa de domínio próprio pra isso funcionar.

## 6. Registrar o webhook do Telegram (só depois do deploy)

Isso só funciona com a URL de produção no ar (não funciona em `localhost`). Rode uma vez, substituindo os valores:

```
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://SEU-PROJETO.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Deve retornar `{"ok":true,"result":true,...}`.

## 7. Testar o fluxo completo

1. Acesse a URL da Vercel → **Abrir chamado** → preencha e envie → confira se a mensagem chegou no seu Telegram.
2. **Entrar → Admin** → faça login com o e-mail/senha criado no passo 2 → deve cair no `/painel` com o kanban.
3. Em `/painel/pessoas`, cadastre um gestor manualmente (com CPF e data de nascimento reais de alguém que topа testar).
4. Peça pra essa pessoa acessar **Entrar → Gestor/Diretoria**, digitar o CPF, confirmar a data de nascimento, clicar em "Abrir no Telegram" e apertar Iniciar no bot, depois "Já vinculei" → deve receber o código no Telegram → digitar o código → cair no painel filtrado pela unidade dela.

## O que ainda falta (fora do escopo desta entrega)

- **Fase 2**: feed/avisos, documentos, cardápios.
- **Fase 3**: construtor de formulários.
- **Sincronização com a planilha de RH** (Google Sheets) — hoje o cadastro de pessoas é manual pelo painel.
- **2FA no login do admin** — habilitar em Authentication → MFA no painel do Supabase (nativo, não precisa de código).
- **Domínio próprio** (`arreyhoteis.com.br`) — adicionar depois em Project Settings → Domains na Vercel, quando for a hora.
