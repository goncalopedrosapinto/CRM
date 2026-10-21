# Baviera Control

Plataforma de gestão de negócios da BMW Motorrad Aveiro (Caetano Baviera). Página única (`index.html`) servida pelo GitHub Pages, com dados no Supabase.

## Como está organizado

| Pasta | O quê |
|---|---|
| `index.html` | A plataforma. Ao mudar, atualizar **as duas** versões no topo: `<meta name="app-version">` e `const APP_VERSION`. |
| `sql/base/` | Esquema da base de dados tal como estava em produção (tabelas, regras, funções). Sem dados. |
| `sql/migracoes/` | Alterações à base de dados, por data. Correm-se à mão no SQL Editor do Supabase. |
| `sql/APLICADAS.txt` | Migrações já corridas em produção. As que não estão aqui são "pendentes". |
| `tests/` | Testes automáticos (ver abaixo). |
| `.github/workflows/testes.yml` | Corre os testes a cada alteração. |

## Testes

Correm sozinhos no GitHub (separador **Actions**) a cada alteração. Localmente: `cd tests && npm install && npx playwright install chromium && npm run todos`.

- **permissoes** — monta uma base de ensaio (Postgres 17 em memória com o esquema real, sem dados de clientes), aplica as migrações pendentes duas vezes e testa cada perfil (chefe, vendedor, secretário, assessor, financeiro, conta nova, anónimo) contra cada tabela.
- **csp** — a política de segurança da página bloqueia envios para sites estranhos e a biblioteca de Excel só carrega se não tiver sido adulterada.
- **xss** — enche todos os campos de texto com código malicioso e percorre todos os ecrãs de todos os perfis e todos os PDFs. Falha se algum campo entrar sem proteção.
- **erros** — erros do browser chegam à tabela `erros_cliente`, sem duplicados e com limite.
- **ecras** — o botão "Apagar" só aparece quando o servidor deixa apagar; conta nova vê a mensagem de espera.
- **encomendas** — lê um ficheiro fictício do portal BMW (CSV em Windows-1252 e Excel), recupera o código de modelo que o Excel estraga, confirma a ordem, que o vendedor só lê e que pesquisa e filtros funcionam. Nunca pôr aqui um ficheiro real: tem apelidos de clientes.
- **integridade** — escreve números à portuguesa a velocidades aleatórias, com rede lenta e falhas, e confirma que o gravado é igual ao escrito.

## Ao mudar a base de dados

1. Criar `sql/migracoes/AAAA-MM-DD_nome.sql` (tem de poder correr duas vezes sem erro).
2. Enviar para o GitHub: os testes correm a migração na base de ensaio.
3. Se passar, correr no SQL Editor do Supabase e acrescentar o nome a `sql/APLICADAS.txt`.
4. De vez em quando, voltar a ler o esquema de produção para `sql/base/` (garante que a base de ensaio não se afasta da real).

## Cópias de segurança

O plano gratuito do Supabase não guarda cópias. A rotina `copia-seguranca.yml` faz uma por noite, cifrada com a frase-senha `COPIA_SENHA`, e repõe-na logo numa base vazia para confirmar que serve (contagem tabela a tabela). As cópias ficam 30 dias em **Actions → Cópia de segurança → execução → Artifacts**.

Abrir uma cópia à mão (precisa de GnuPG; no Windows, Gpg4win): `gpg -d copia-AAAA-MM-DD.tar.gz.gpg | tar xzf -`. Repor no Supabase: correr `pg_restore` com a ligação do projeto — pedir ajuda antes de o fazer.

O GitHub desliga rotinas agendadas em repositórios públicos sem alterações durante 60 dias: se isso acontecer, aparece um aviso no separador Actions e basta reativar.
