# Planning Poker

Sala de estimativas em tempo real para até 10 participantes. O app pode ser publicado sem custo usando o plano gratuito do Supabase e uma hospedagem estática gratuita, como Cloudflare Pages.

## Configuração do Supabase

1. Crie um projeto gratuito em [supabase.com](https://supabase.com/).
2. No painel, abra **SQL Editor**, cole e execute `supabase/schema.sql`.
3. Em **Project Settings > API**, copie a Project URL e a chave publicável (`anon`/`publishable`). Nunca use a `service_role` no frontend.
4. Crie `.env.local` na raiz usando `.env.example` como modelo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica
```

5. Reinicie o servidor local após configurar as variáveis.

## Executar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Publicar sem custo

1. Envie este projeto para um repositório GitHub.
2. Crie um site no Cloudflare Pages conectado ao repositório.
3. Configure o comando de build como `npm run build` e a pasta de saída como `out`.
4. Adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` nas variáveis de ambiente do Pages para Production e Preview.
5. Faça o deploy. O endereço gratuito fornecido pelo Pages pode ser compartilhado; cada administrador cria uma sala e compartilha o link daquela sala.

O app exporta arquivos estáticos e não precisa de servidor Next.js pago. Supabase e Cloudflare Pages têm cotas gratuitas sujeitas às regras atuais dos respectivos planos; o uso além das cotas pode exigir reduzir tráfego ou migrar de plano.

## Como funciona

- O administrador cria a sala, adiciona tarefas e revela/esconde os votos.
- O convite contém apenas o código da sala; não inclui credenciais administrativas.
- Cada participante entra com seu nome e pode votar uma vez por tarefa, alterando seu voto enquanto a rodada estiver aberta.
- Os votos ficam secretos no banco até o administrador revelar a rodada.
- O limite de 10 participantes é verificado pelo banco em cada entrada.
- A presença é mantida enquanto o participante mantiver a sessão do navegador. A sala continua disponível pelo link enquanto os dados permanecerem no Supabase.

## Segurança

O token administrativo e o token de cada participante são aleatórios e mantidos na sessão do navegador; o banco guarda apenas hashes. A chave `anon`/publicável é própria para frontend e as operações são validadas por funções SQL. Não publique a chave `service_role`.
