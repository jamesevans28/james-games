#!/usr/bin/env bash
# Creates the Games4James Firebase project and wires local development to it (plan T6.0).
#
#   scripts/firebase-setup.sh            # do it
#   scripts/firebase-setup.sh --dry-run  # print the commands only
#
# Needs: the Firebase CLI (`firebase login` done) and gcloud (`gcloud auth login`
# done), both as the Google account that should own the project. Never prints
# secrets: the service-account key goes to ~/.config/games4james/ (outside the
# repo) and its values go straight into apps/backend-api/.env.local.
set -euo pipefail

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1
run() { if ((DRY)); then echo "+ $*"; else "$@"; fi; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SET_ENV="node $ROOT/scripts/lib/set-env.mjs"
PROJECT="${G4J_FIREBASE_PROJECT:-games4james}"
# PATCH replaces the list, so keep Firebase's own default domains in it.
DOMAINS="[\"localhost\",\"$PROJECT.firebaseapp.com\",\"$PROJECT.web.app\",\"games4james.com\",\"auth.games4james.com\"]"
KEY_DIR="$HOME/.config/games4james"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
pause() { ((DRY)) && return; read -r -p "$* Press Enter when done. " _; }

say "1/6 Checking tools"
command -v firebase >/dev/null || { echo "Install the Firebase CLI: npm i -g firebase-tools"; exit 1; }
command -v gcloud >/dev/null || { echo "Install gcloud: https://cloud.google.com/sdk/docs/install"; exit 1; }
((DRY)) || firebase login:list | grep -q "@" || { echo "Run: firebase login"; exit 1; }
((DRY)) || gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@" || { echo "Run: gcloud auth login"; exit 1; }

say "2/6 Creating the Firebase project ($PROJECT)"
if ((DRY)) || ! firebase projects:list 2>/dev/null | grep -q " $PROJECT "; then
  if ! run firebase projects:create "$PROJECT" --display-name "Games4James"; then
    echo "The id '$PROJECT' may be taken. Re-run with: G4J_FIREBASE_PROJECT=games4james-app $0"
    exit 1
  fi
else
  echo "Project $PROJECT already exists; reusing it."
fi
run gcloud services enable identitytoolkit.googleapis.com iam.googleapis.com --project "$PROJECT"

say "3/6 Web app config → apps/player-web/.env.local and apps/admin-web/.env.local"
APP_ID="$( ((DRY)) && echo "1:000:web:dryrun" || firebase apps:list WEB --project "$PROJECT" 2>/dev/null | grep -o '1:[0-9]*:web:[a-z0-9]*' | head -1 || true)"
if [[ -z "$APP_ID" ]]; then
  run firebase apps:create WEB games4james-web --project "$PROJECT"
  APP_ID="$(firebase apps:list WEB --project "$PROJECT" | grep -o '1:[0-9]*:web:[a-z0-9]*' | head -1)"
fi
if ((DRY)); then
  echo "+ firebase apps:sdkconfig WEB $APP_ID --project $PROJECT --json | set-env.mjs (both web apps)"
else
  CONFIG="$(firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT" --json)"
  get() { node -e 'const c=JSON.parse(process.argv[1]);const r=c.result?.sdkConfig??c.result??c;process.stdout.write(String(r[process.argv[2]]??""))' "$CONFIG" "$1"; }
  for app in player-web admin-web; do
    $SET_ENV "$ROOT/apps/$app/.env.local" \
      "VITE_FIREBASE_API_KEY=$(get apiKey)" \
      "VITE_FIREBASE_AUTH_DOMAIN=$(get authDomain)" \
      "VITE_FIREBASE_PROJECT_ID=$(get projectId)" \
      "VITE_FIREBASE_STORAGE_BUCKET=$(get storageBucket)" \
      "VITE_FIREBASE_MESSAGING_SENDER_ID=$(get messagingSenderId)" \
      "VITE_FIREBASE_APP_ID=$(get appId)"
  done
fi

say "4/6 Turn Authentication on (console, one click)"
echo "Open https://console.firebase.google.com/project/$PROJECT/authentication and click 'Get started'."
echo "Then Sign-in method → Anonymous → Enable → Save."
pause "Authentication started and Anonymous enabled?"

say "5/6 Authorised domains"
if ((DRY)); then
  echo "+ PATCH identitytoolkit admin/v2 config authorizedDomains=$DOMAINS"
else
  TOKEN="$(gcloud auth print-access-token)"
  curl -fsS -X PATCH \
    -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" -H "Content-Type: application/json" \
    "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config?updateMask=authorizedDomains" \
    -d "{\"authorizedDomains\": $DOMAINS}" >/dev/null && echo "Authorised domains set: $DOMAINS"
fi

say "6/6 Backend service account → apps/backend-api/.env.local"
mkdir -p "$KEY_DIR" && chmod 700 "$KEY_DIR"
KEY_FILE="$KEY_DIR/$PROJECT-admin.json"
if ((DRY)); then
  echo "+ gcloud iam service-accounts keys create $KEY_FILE --iam-account firebase-adminsdk-…@$PROJECT.iam.gserviceaccount.com"
  echo "+ set-env.mjs apps/backend-api/.env.local --from-json $KEY_FILE"
else
  SA="$(gcloud iam service-accounts list --project "$PROJECT" --format='value(email)' | grep firebase-adminsdk | head -1)"
  [[ -n "$SA" ]] || { echo "No firebase-adminsdk service account yet: open Project settings → Service accounts once, then re-run."; exit 1; }
  [[ -f "$KEY_FILE" ]] || gcloud iam service-accounts keys create "$KEY_FILE" --iam-account "$SA" --project "$PROJECT" >/dev/null
  chmod 600 "$KEY_FILE"
  $SET_ENV "$ROOT/apps/backend-api/.env.local" --from-json "$KEY_FILE"
fi

say "Done. Still to do in the console (values in docs/firebase-auth-setup.md):"
cat <<STEPS
  • Authentication → Sign-in method → Google → Enable (choose your support email).
  • Google Cloud console → APIs & Services → OAuth consent screen (Branding):
      app name "Games4James", logo apps/player-web/public/brand/icon-512.png,
      home page https://games4james.com, privacy https://games4james.com/privacy.
  • Apple sign-in waits for Phase 10.
Then restart \`npm run dev\` and \`npm run server\`.
STEPS
