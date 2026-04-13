#!/bin/bash
# Script para fazer push para o GitHub
# 
# Uso:
#   ./push.sh https://github.com/seu-usuario/compra-de-ouro.git
#   ou
#   ./push.sh git@github.com:seu-usuario/compra-de-ouro.git

REPO_URL=$1

if [ -z "$REPO_URL" ]; then
  echo "❌ URL do repositório não fornecida"
  echo "Uso: ./push.sh <repo-url>"
  echo ""
  echo "Exemplos:"
  echo "  ./push.sh https://github.com/seu-usuario/compra-de-ouro.git"
  echo "  ./push.sh git@github.com:seu-usuario/compra-de-ouro.git"
  exit 1
fi

echo "🚀 Fazendo push para: $REPO_URL"

git remote add origin "$REPO_URL" || git remote set-url origin "$REPO_URL"
git branch -M main
git push -u origin main

echo "✅ Push realizado com sucesso!"
echo "Acesse: $REPO_URL"
