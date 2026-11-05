#!/usr/bin/env bash
# Instala/inicia MySQL local e cria DB/usuário a partir de .env.local
# Uso: bash scripts/setup-local-mysql.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta $ENV_FILE — gere o arquivo antes de continuar." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# Lê só MYSQL_* (evita side-effects de outras vars)
while IFS= read -r line || [[ -n "$line" ]]; do
  trimmed="${line%%#*}"
  trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
  [[ -z "$trimmed" ]] && continue
  case "$trimmed" in
    MYSQL_*=*) eval "export $trimmed" ;;
  esac
done < "$ENV_FILE"
set +a

: "${MYSQL_HOST:?}"
: "${MYSQL_PORT:?}"
: "${MYSQL_USER:?}"
: "${MYSQL_PASSWORD:?}"
: "${MYSQL_DATABASE:?}"

export DEBIAN_FRONTEND=noninteractive

need_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

echo "==> Verificando pacote MySQL/MariaDB..."
if ! dpkg -l mysql-server 2>/dev/null | grep -q '^ii'; then
  if dpkg -l mariadb-server 2>/dev/null | grep -q '^ii'; then
    echo "MariaDB já instalado."
  else
    echo "==> Instalando mysql-server (precisa de sudo)..."
    need_sudo apt-get update -y
    need_sudo apt-get install -y mysql-server
  fi
else
  echo "mysql-server já instalado."
fi

SVC=""
if systemctl list-unit-files mysql.service 2>/dev/null | grep -q mysql.service; then
  SVC=mysql
elif systemctl list-unit-files mariadb.service 2>/dev/null | grep -q mariadb.service; then
  SVC=mariadb
else
  echo "Nenhum unit mysql/mariadb encontrado após instalação." >&2
  exit 1
fi

echo "==> Iniciando e habilitando $SVC..."
need_sudo systemctl enable --now "$SVC"
need_sudo systemctl is-active "$SVC"

echo "==> Criando database e usuário (privileges só em ${MYSQL_DATABASE}.*)..."
# Root auth no Ubuntu MySQL 8: auth_socket — usar sudo mysql
need_sudo mysql --protocol=socket <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}';
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';

ALTER USER '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}';
ALTER USER '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';

GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> Testando conexão TCP em ${MYSQL_HOST}:${MYSQL_PORT}..."
mysql --protocol=TCP -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  -e "SELECT 1 AS ok; SELECT DATABASE();" "$MYSQL_DATABASE"

echo "==> Aplicando schema..."
cd "$ROOT"
npm run db:migrar

echo "OK. MySQL ativo, DB pronto, schema aplicado."
echo "Próximo passo: npm run dev"
