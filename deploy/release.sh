#!/usr/bin/env bash
# Switch a slot to an unpacked release, check it's healthy, and roll back if it isn't.
# Runs on the server as the deploy user, from inside the new release:
#
#   bash /srv/hindsight/<slot>/releases/<id>/deploy/release.sh <slot> <id> <port>
#
# Layout:  /srv/hindsight/<slot>/releases/<id>/   one directory per deploy (build/ + package.json)
#          /srv/hindsight/<slot>/current          symlink to the live release
#          /srv/hindsight/<slot>/shared/          survives deploys (the preview's runtime.env)
set -euo pipefail

slot=${1:?slot}
id=${2:?release id}
port=${3:?port}
[[ $slot =~ ^(prod|preview)$ ]] || { echo "unknown slot: $slot" >&2; exit 2; }
[[ $id =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad release id: $id" >&2; exit 2; }
[[ $port =~ ^[0-9]+$ ]] || { echo "bad port: $port" >&2; exit 2; }

# HINDSIGHT_ROOT only exists for testing this script somewhere other than the server.
base=${HINDSIGHT_ROOT:-/srv/hindsight}/$slot
release=$base/releases/$id
[[ -f $release/build/index.js ]] || { echo "no build in $release" >&2; exit 1; }

# Point `current` at a release in one atomic rename, never a half-switched symlink.
point_at() {
	ln -sfn "$1" "$base/current.next"
	mv -T "$base/current.next" "$base/current"
}

healthy() {
	for _ in $(seq 1 30); do
		if curl -fs -o /dev/null --max-time 5 "http://127.0.0.1:$port/"; then return 0; fi
		sleep 1
	done
	return 1
}

# Only a real symlink to a release counts. On the first deploy `current` doesn't exist yet, and
# `readlink -f` would return the path itself, so a failed first deploy would "roll back" to a
# symlink pointing at itself.
previous=
if [[ -L $base/current ]]; then
	previous=$(readlink -f "$base/current" 2>/dev/null || true)
	[[ $previous == "$base"/releases/* ]] || previous=
fi
point_at "$release"
sudo /usr/bin/systemctl restart "hindsight@$slot"

if ! healthy; then
	echo "Release $id failed its health check." >&2
	if [[ -n $previous && -d $previous && $previous != "$release" ]]; then
		echo "Rolling back to $(basename "$previous")." >&2
		point_at "$previous"
		sudo /usr/bin/systemctl restart "hindsight@$slot"
		if healthy; then
			echo "Rolled back: $(basename "$previous") is serving again." >&2
		else
			echo "The rollback is unhealthy too. Check: journalctl -u hindsight@$slot" >&2
		fi
	fi
	exit 1
fi

# Keep the five newest releases, so a manual rollback is one symlink away.
ls -1dt "$base"/releases/*/ | tail -n +6 | xargs -r rm -rf
echo "Release $id is live on $slot."
