#!/usr/bin/env bash

set -u

(
  set -euo pipefail

REPO_DIR_NAME="GatorGuide"
REPO_URL="https://github.com/MarsLuay/GatorGuide.git"
SERVER_PORT="8081"
SERVER_URL="http://127.0.0.1:${SERVER_PORT}"
LOG_PREFIX="[Start-to-run]"

SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd)"
APP_BUNDLE_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(cd -- "$APP_BUNDLE_DIR/.." && pwd)"
APP_DIR="$ROOT_DIR/source"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export PATH

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$*"
}

fail() {
  printf '%s %s\n' "$LOG_PREFIX" "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

run_with_privilege() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if command_exists sudo; then
    sudo "$@"
    return
  fi

  fail "Need elevated privileges to run: $*"
}

detect_os() {
  uname -s
}

install_git() {
  case "$(detect_os)" in
    Darwin)
      if command_exists brew; then
        log "Git was not found. Installing Git with Homebrew..."
        brew install git
      else
        fail "Git is missing and Homebrew is not installed. Install Homebrew from https://brew.sh or Git from https://git-scm.com/downloads and run this script again."
      fi
      ;;
    Linux)
      if command_exists apt-get; then
        log "Git was not found. Installing Git with apt..."
        run_with_privilege apt-get update
        run_with_privilege apt-get install -y git
      elif command_exists dnf; then
        log "Git was not found. Installing Git with dnf..."
        run_with_privilege dnf install -y git
      elif command_exists yum; then
        log "Git was not found. Installing Git with yum..."
        run_with_privilege yum install -y git
      elif command_exists pacman; then
        log "Git was not found. Installing Git with pacman..."
        run_with_privilege pacman -Sy --noconfirm git
      elif command_exists zypper; then
        log "Git was not found. Installing Git with zypper..."
        run_with_privilege zypper install -y git
      elif command_exists apk; then
        log "Git was not found. Installing Git with apk..."
        run_with_privilege apk add --no-cache git
      else
        fail "Git is missing and no supported package manager was found. Install Git from https://git-scm.com/downloads and run this script again."
      fi
      ;;
    *)
      fail "Unsupported OS: $(detect_os)"
      ;;
  esac

  command_exists git || fail "Git installation finished, but 'git' is still unavailable in this shell."
  log "Git finished installing successfully."
}

install_node_toolchain() {
  case "$(detect_os)" in
    Darwin)
      if command_exists brew; then
        log "Node.js was not found. Installing Node.js with Homebrew..."
        brew install node
      else
        fail "Node.js is missing and Homebrew is not installed. Install Homebrew from https://brew.sh or Node.js from https://nodejs.org/ and run this script again."
      fi
      ;;
    Linux)
      if command_exists apt-get; then
        log "Node.js was not found. Installing Node.js with apt..."
        run_with_privilege apt-get update
        run_with_privilege apt-get install -y nodejs npm
      elif command_exists dnf; then
        log "Node.js was not found. Installing Node.js with dnf..."
        run_with_privilege dnf install -y nodejs npm
      elif command_exists yum; then
        log "Node.js was not found. Installing Node.js with yum..."
        run_with_privilege yum install -y nodejs npm
      elif command_exists pacman; then
        log "Node.js was not found. Installing Node.js with pacman..."
        run_with_privilege pacman -Sy --noconfirm nodejs npm
      elif command_exists zypper; then
        log "Node.js was not found. Installing Node.js with zypper..."
        run_with_privilege zypper install -y nodejs npm
      elif command_exists apk; then
        log "Node.js was not found. Installing Node.js with apk..."
        run_with_privilege apk add --no-cache nodejs npm
      else
        fail "Node.js is missing and no supported package manager was found. Install Node.js from https://nodejs.org/ and run this script again."
      fi
      ;;
    *)
      fail "Unsupported OS: $(detect_os)"
      ;;
  esac

  command_exists node || fail "Node.js installation finished, but 'node' is still unavailable in this shell."
  command_exists npm || fail "npm is unavailable after installing Node.js."
  command_exists npx || fail "npx is unavailable after installing Node.js."
  log "Node.js finished installing successfully."
}

locate_or_clone_repo() {
  if [ -f "$APP_DIR/package.json" ]; then
    log "Found Gator Guide in \"$ROOT_DIR\"."
    return
  fi

  local clone_root="$ROOT_DIR/$REPO_DIR_NAME"
  if [ -f "$clone_root/source/package.json" ]; then
    ROOT_DIR="$clone_root"
    APP_DIR="$ROOT_DIR/source"
    log "Found Gator Guide in \"$ROOT_DIR\"."
    return
  fi

  log "Gator Guide was not found next to this launcher."
  ensure_git

  if [ -e "$clone_root" ]; then
    fail "Cannot clone into \"$clone_root\" because that path already exists."
  fi

  log "Cloning Gator Guide into \"$clone_root\"..."
  git clone "$REPO_URL" "$clone_root"

  ROOT_DIR="$clone_root"
  APP_DIR="$ROOT_DIR/source"
  [ -f "$APP_DIR/package.json" ] || fail "The repo finished cloning, but \"$APP_DIR/package.json\" is still missing."
  log "Repo cloned successfully."
}

ensure_git() {
  if command_exists git; then
    log "Git is already installed."
    return
  fi

  install_git
}

ensure_node_toolchain() {
  if command_exists node && command_exists npm && command_exists npx; then
    log "Node.js is already installed."
    return
  fi

  install_node_toolchain
}

ensure_env_file() {
  if [ -f "$APP_DIR/.env" ]; then
    log "Existing .env found. Skipping env setup."
    return
  fi

  if [ ! -f "$APP_DIR/.env.example" ]; then
    return
  fi

  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  log "Created source/.env from .env.example."
}

ensure_app_dependencies() {
  if [ -d "$APP_DIR/node_modules" ]; then
    log "Checking app dependencies..."
    if (
      cd "$APP_DIR"
      npm ls --depth=0 >/dev/null 2>&1
    ); then
      log "App dependencies are already installed."
      return
    fi

    log "App dependencies are incomplete. Reinstalling..."
  fi

  log "Installing app dependencies. This may take a few minutes..."
  if ! (
    cd "$APP_DIR"
    npm ci
  ); then
    log "npm ci failed, trying npm install instead..."
    (
      cd "$APP_DIR"
      npm install
    ) || fail "Installing app dependencies failed."
  fi
  log "App dependencies installed successfully."
}

sync_expo_packages() {
  log "Checking Expo package compatibility..."
  if (
    cd "$APP_DIR"
    npx expo install --check >/dev/null 2>&1
  ); then
    log "Expo packages are already compatible with this SDK."
    return
  fi

  log "Updating Expo-managed packages for this SDK..."
  (
    cd "$APP_DIR"
    npx expo install --fix --npm
  ) || {
    printf '%s %s\n' "$LOG_PREFIX" "Expo package update failed." >&2
    printf '%s %s\n' "$LOG_PREFIX" "Run \`npx expo install --fix --npm\` manually from:" >&2
    printf '%s %s\n' "$LOG_PREFIX" "$APP_DIR" >&2
    exit 1
  }

  log "Expo packages updated successfully."
}

wait_for_server() {
  local max_wait_seconds="${1:-120}"
  local attempt=1

  while [ "$attempt" -le "$max_wait_seconds" ]; do
    if node -e "const net=require('net'); const client=net.createConnection({host:'127.0.0.1',port:${SERVER_PORT}}); client.setTimeout(1000); client.on('connect',()=>{client.end(); process.exit(0);}); client.on('timeout',()=>{client.destroy(); process.exit(1);}); client.on('error',()=>process.exit(1));" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  return 1
}

open_url() {
  local url="$1"

  if command_exists open; then
    open "$url" >/dev/null 2>&1 && return 0
  fi

  if command_exists xdg-open; then
    xdg-open "$url" >/dev/null 2>&1 && return 0
  fi

  if command_exists gio; then
    gio open "$url" >/dev/null 2>&1 && return 0
  fi

  if command_exists python3; then
    python3 -m webbrowser "$url" >/dev/null 2>&1 && return 0
  fi

  return 1
}

open_browser_when_server_ready() {
  (
    if wait_for_server 120; then
      if ! open_url "$SERVER_URL"; then
        log "The browser did not open automatically."
        log "Open this URL manually: $SERVER_URL"
      fi
    fi
  ) &
}

organize_tmp() {
  if [ -f "$APP_DIR/scripts/organize-tmp-artifacts.cjs" ] && command_exists node; then
    node "$APP_DIR/scripts/organize-tmp-artifacts.cjs" --quiet >/dev/null 2>&1 || true
  fi
}

choose_startup_mode() {
  local requested_mode="${GATORGUIDE_STARTUP_MODE:-}"
  requested_mode="$(printf '%s' "$requested_mode" | tr '[:upper:]' '[:lower:]')"

  case "$requested_mode" in
    1|run|normal)
      requested_mode="normal"
      ;;
    2|demo)
      requested_mode="demo"
      ;;
    "")
      ;;
    *)
      fail "Unsupported startup mode \"$GATORGUIDE_STARTUP_MODE\". Use normal or demo."
      ;;
  esac

  while [ -z "$requested_mode" ]; do
    printf '\nChoose startup mode:\n'
    printf '  1. Run normally\n'
    printf '  2. Demo mode\n\n'
    printf 'Enter 1 or 2: '

    if ! IFS= read -r requested_mode; then
      requested_mode="normal"
    fi

    requested_mode="$(printf '%s' "$requested_mode" | tr '[:upper:]' '[:lower:]')"
    case "$requested_mode" in
      1|run|normal)
        requested_mode="normal"
        ;;
      2|demo)
        requested_mode="demo"
        ;;
      *)
        log "Please enter 1 or 2."
        requested_mode=""
        ;;
    esac
  done

  if [ "$requested_mode" = "demo" ]; then
    export GATORGUIDE_STARTUP_MODE="demo"
    export GATORGUIDE_DEMO_MODE="1"
    export EXPO_PUBLIC_GATORGUIDE_DEMO_MODE="1"
    log "Demo mode selected. Human-reviewed Course Planner demo data will load on demand."
    return
  fi

  export GATORGUIDE_STARTUP_MODE="normal"
  unset GATORGUIDE_DEMO_MODE
  unset EXPO_PUBLIC_GATORGUIDE_DEMO_MODE
  log "Normal startup selected."
}

main() {
  log "Preparing Gator Guide for launch..."
  choose_startup_mode
  locate_or_clone_repo
  ensure_node_toolchain
  ensure_env_file
  ensure_app_dependencies
  sync_expo_packages

  log "Starting Expo..."
  log "The Expo page will open in your default browser when it is ready."
  open_browser_when_server_ready
  (
    cd "$APP_DIR"
    EXPO_START_PORT="$SERVER_PORT" npm run start
  ) || {
    organize_tmp
    printf '%s %s\n' "$LOG_PREFIX" "Failed to start Expo." >&2
    printf '%s %s\n' "$LOG_PREFIX" "Run \`npm run start\` manually from:" >&2
    printf '%s %s\n' "$LOG_PREFIX" "$APP_DIR" >&2
    exit 1
  }
  organize_tmp
}

main "$@"
)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  printf '\nGator Guide failed with exit code %s.\n' "$STATUS" >&2
  printf 'Press Enter to close this window...'
  IFS= read -r _
fi

exit "$STATUS"
