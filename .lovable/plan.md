

## Melhorias no GitRemix

### Problema identificado
1. **Token**: O app pede um "GitHub Token" mas nao explica de qual conta ele deve ser. O token precisa ter acesso de **leitura** no repo fonte (conta mae) e acesso de **escrita** no repo destino (conta filha). Na pratica, se ambos os repos sao da mesma conta, um unico token resolve. Se sao de contas diferentes, o token precisa ser de uma conta que tenha permissao nos dois repos.

2. **Terminologia**: Trocar "Repositorio Fonte" e "Repositorio Destino" para "Conta Mae" e "Conta Filha" para ficar mais claro.

3. **Status do sistema**: A edge function esta funcionando corretamente (testada e respondendo).

### Mudancas planejadas

**1. Atualizar labels e textos na UI (`src/pages/Index.tsx`)**
- "Repositorio Fonte" → "Conta Mae (tem o conteudo)"
- "Repositorio Destino" → "Conta Filha (vai receber)"
- Adicionar texto explicativo sobre o token: "Use um token com permissao de leitura na Conta Mae e escrita na Conta Filha. Se ambos sao da mesma conta GitHub, um token so basta."
- Adicionar dica sobre como criar o token (link para github.com/settings/tokens)

**2. Melhorar instrucoes do token**
- Adicionar tooltip ou texto abaixo do campo de token explicando:
  - O token precisa ter permissao `repo` (acesso completo a repositorios)
  - Deve funcionar para ambos os repos (mae e filha)

### Detalhes tecnicos
- Apenas alteracoes no arquivo `src/pages/Index.tsx`
- Mudancas sao somente de texto/UI, sem alteracao na logica
- A edge function permanece inalterada (ja esta funcionando)

