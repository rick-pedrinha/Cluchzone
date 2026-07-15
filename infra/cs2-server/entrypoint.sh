#!/usr/bin/env bash
set -Eeuo pipefail

secret_dir=/run/secrets/clutchzone
cs2_dir=/opt/cs2

read_secret() {
  local name="$1"
  local file="${secret_dir}/${name}"
  if [[ ! -s "$file" ]]; then
    echo "Missing required CS2 secret file: ${name}" >&2
    exit 1
  fi
  tr -d '\r\n' < "$file"
}

gslt="$(read_secret gslt)"
server_password="$(read_secret server_password)"
rcon_password="$(read_secret rcon_password)"
start_map="$(read_secret start_map)"

if [[ ! "$start_map" =~ ^de_[a-z0-9_]+$ ]]; then
  echo "Invalid CS2 start map." >&2
  exit 1
fi

chown -R steam:steam "$cs2_dir" /home/steam

runuser --user steam -- env HOME=/home/steam steamcmd \
  +force_install_dir "$cs2_dir" \
  +login anonymous \
  +app_update 730 validate \
  +quit

mkdir -p /home/steam/.steam/sdk64
ln -sf "$cs2_dir/game/bin/linuxsteamrt64/steamclient.so" /home/steam/.steam/sdk64/steamclient.so
chown -R steam:steam /home/steam/.steam

exec runuser --user steam -- env HOME=/home/steam "$cs2_dir/game/bin/linuxsteamrt64/cs2" \
  -dedicated \
  -console \
  -usercon \
  -port 27015 \
  +game_type 0 \
  +game_mode 1 \
  +map "$start_map" \
  +sv_setsteamaccount "$gslt" \
  +sv_password "$server_password" \
  +rcon_password "$rcon_password"
