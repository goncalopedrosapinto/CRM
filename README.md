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
- **encomendas** — lê um ficheiro fictício do portal BMW (CSV em Windows-1252 e Excel), recupera o código de modelo que o Excel estraga, confirma a ordem, que o vendedor só lê e que pesquisa e filtros funcionam. Também testa as três origens (Stock Aveiro, Rede e BMW: deteção pelo critério do portal, pelo nome ou pelos concessionários; cada uma gravada à parte; sem clientes de outros concessionários) e "estou a negociar": quem vê o quê, a escolha do negócio, os avisos no campo Encomenda e os alertas de reserva parada. Nunca pôr aqui um ficheiro real: tem apelidos de clientes.
- **eotimg** — colar um print (Ctrl+V) num comentário de EOT: a imagem é reduzida, vai para o Storage privado na pasta do contrato e aparece no histórico carregada com a sessão (sem links públicos).
- **adenda** — EOTs com adenda contam como renovado; quando o mapa traz o mesmo contrato com data de fim nova, a importação mostra-o e volta a pô-lo em "Por contactar" (fica a data da adenda). Sem o SQL, avisa em vez de falhar.
- **alertas** — declaração de circulação (mota nova vendida, 90 dias depois da matrícula; "Por atualizar" mantém o aviso, "Atualizada" tira-o) e aniversários dos clientes (um aviso por cliente; à segunda inclui o fim de semana; 29/02 a 28/02). Sem o SQL, os campos novos não aparecem e o negócio grava sem eles.
- **notificacoes** — notificações das EOTs: a última indicação espera pelo outro lado (vendedor/chefe → financeiros; financeiro → responsável e chefe se escreveu); «Lido» por pessoa; responder passa a notificação; o chefe vê as conversas penduradas; aviso do computador com a página em segundo plano.
- **stus** — lembrete ao chefe: motas ST de Aveiro com 90+ dias no stand (desde 193) para pedir a mudança para US; Home e A tratar, "→ US" na tabela, "Já pedi" esconde até ao próximo ficheiro.
- **equip** — Stock Equipamento: referência com ou sem espaços; aviso quando está noutra loja; referência fora do mapa procurada no site (e a venda fora do stock já vem preenchida); filtros de antiguidade e desconto mínimo; ordenar por mais tempo sem vender.
- **acessibilidade** — axe-core (WCAG 2.2 AA) em ~45 ecrãs dos 5 perfis, computador e telemóvel, claro e escuro, mais medição à mão do contraste que o axe não decide (números pequenos, placeholders). Falha com qualquer violação.
- **fichas** — várias fichas de margem no mesmo negócio (uma por mota): cada uma grava na sua linha, troca sem misturar dados, marcar a vendida arquiva as outras, alerta enquanto não se escolhe; e aprovação quando o esforço passa a margem variável.
- **integridade** — escreve números à portuguesa a velocidades aleatórias, com rede lenta e falhas, e confirma que o gravado é igual ao escrito.

## Ao mudar a base de dados

1. Criar `sql/migracoes/AAAA-MM-DD_nome.sql` (tem de poder correr duas vezes sem erro).
2. Enviar para o GitHub: os testes correm a migração na base de ensaio.
3. Se passar, correr no SQL Editor do Supabase e acrescentar o nome a `sql/APLICADAS.txt`.
4. De vez em quando, voltar a ler o esquema de produção para `sql/base/` (garante que a base de ensaio não se afasta da real).

## Cópias de segurança

O plano gratuito do Supabase não guarda cópias. **As imagens das EOTs (Storage) não entram nesta cópia**: só a base de dados. A rotina `copia-seguranca.yml` faz uma por noite, cifrada com a frase-senha `COPIA_SENHA`, e repõe-na logo numa base vazia para confirmar que serve (contagem tabela a tabela). As cópias ficam 30 dias em **Actions → Cópia de segurança → execução → Artifacts**.

Abrir uma cópia à mão (precisa de GnuPG; no Windows, Gpg4win): `gpg -d copia-AAAA-MM-DD.tar.gz.gpg | tar xzf -`. Repor no Supabase: correr `pg_restore` com a ligação do projeto — pedir ajuda antes de o fazer.

O GitHub desliga rotinas agendadas em repositórios públicos sem alterações durante 60 dias: se isso acontecer, aparece um aviso no separador Actions e basta reativar.
