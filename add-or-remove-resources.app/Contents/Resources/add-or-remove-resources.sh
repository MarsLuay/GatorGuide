#!/usr/bin/env bash

set -euo pipefail

REPO_DIR_NAME="GatorGuide"
REPO_URL="https://github.com/MarsLuay/GatorGuide.git"
LOG_PREFIX="[add-or-remove-resources]"

SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd)"
APP_BUNDLE_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd -- "$APP_BUNDLE_DIR/.." && pwd)"
APP_ROOT="$REPO_ROOT/source"
NODE_SCRIPT="$APP_ROOT/scripts/assets/add-catalog-item.cjs"
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
        fail "Git is missing and Homebrew is not installed. Install Homebrew from https://brew.sh or Git from https://git-scm.com/downloads and run this launcher again."
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
        fail "Git is missing and no supported package manager was found. Install Git from https://git-scm.com/downloads and run this launcher again."
      fi
      ;;
    *)
      fail "Unsupported OS: $(detect_os)"
      ;;
  esac

  command_exists git || fail "Git installation finished, but 'git' is still unavailable in this shell."
  log "Git finished installing successfully."
}

ensure_git() {
  if command_exists git; then
    log "Git is already installed."
    return
  fi

  install_git
}

locate_or_clone_repo() {
  if [ -f "$NODE_SCRIPT" ]; then
    return
  fi

  local clone_root="$REPO_ROOT/$REPO_DIR_NAME"
  if [ -f "$clone_root/source/scripts/assets/add-catalog-item.cjs" ]; then
    REPO_ROOT="$clone_root"
    APP_ROOT="$REPO_ROOT/source"
    NODE_SCRIPT="$APP_ROOT/scripts/assets/add-catalog-item.cjs"
    log "Found Gator Guide in \"$REPO_ROOT\"."
    return
  fi

  log "Gator Guide was not found next to this launcher."
  ensure_git

  if [ -e "$clone_root" ]; then
    fail "Cannot clone into \"$clone_root\" because that path already exists."
  fi

  log "Cloning Gator Guide into \"$clone_root\"..."
  git clone "$REPO_URL" "$clone_root"

  REPO_ROOT="$clone_root"
  APP_ROOT="$REPO_ROOT/source"
  NODE_SCRIPT="$APP_ROOT/scripts/assets/add-catalog-item.cjs"
  [ -f "$NODE_SCRIPT" ] || fail "The repo finished cloning, but \"$NODE_SCRIPT\" is still missing."
  log "Repo cloned successfully."
}

organize_tmp() {
  if [ -f "$APP_ROOT/scripts/organize-tmp-artifacts.cjs" ] && command_exists node; then
    node "$APP_ROOT/scripts/organize-tmp-artifacts.cjs" --quiet >/dev/null 2>&1 || true
  fi
}

main() {
  locate_or_clone_repo
  [ -f "$NODE_SCRIPT" ] || fail "Could not find \"$NODE_SCRIPT\"."
  command_exists node || fail "Node.js was not found. Install Node.js from https://nodejs.org/ and run this launcher again."
  cd "$REPO_ROOT"
  set +e
  node "$NODE_SCRIPT" "$@"
  local exit_code="$?"
  set -e
  organize_tmp
  exit "$exit_code"
}

main "$@"
