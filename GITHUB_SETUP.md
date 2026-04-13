# 📦 Como fazer upload para GitHub

## Passo 1: Criar repositório no GitHub (30 segundos)

1. Acesse https://github.com/new
2. **Nome do repositório**: `compra-de-ouro`
3. **Descrição** (opcional): "SaaS ERP/Livro-Caixa para Casa de Compra e Venda de Ouro"
4. Selecione **Public** (ou Private conforme preferência)
5. ⚠️ **NÃO** marque "Initialize this repository with:"
6. Clique em **"Create repository"**

## Passo 2: Copiar a URL

Na tela que aparecer, você verá dois botões: **HTTPS** e **SSH**

- **Se você quer usar HTTPS** (mais simples, sem chave SSH):
  - URL será algo como: `https://github.com/seu-usuario/compra-de-ouro.git`

- **Se você tem chave SSH configurada**:
  - URL será algo como: `git@github.com:seu-usuario/compra-de-ouro.git`

## Passo 3: Fazer o push (automático)

Assim que você me passar a URL completa (HTTPS ou SSH), eu executo:

```bash
git remote add origin <sua-url>
git branch -M main
git push -u origin main
```

Ou você pode executar pelo git bash/terminal:

```bash
# Substitua pela sua URL
git remote add origin https://github.com/seu-usuario/compra-de-ouro.git
git branch -M main
git push -u origin main
```

## Problemas comuns

### Authentication failed
Se receber erro de autenticação HTTPS:
1. Gere um token em https://github.com/settings/tokens
2. Use o token como senha

### SSH key not found
Se receber erro SSH:
1. Configure sua chave SSH: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

## ✅ Pronto!

Assim que o push terminar, o repositório estará online em:
`https://github.com/seu-usuario/compra-de-ouro`
