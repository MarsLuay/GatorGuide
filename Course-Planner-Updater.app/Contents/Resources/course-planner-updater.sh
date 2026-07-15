#!/usr/bin/env bash

set -u

(
  set -euo pipefail

REPO_DIR_NAME="GatorGuide"
REPO_URL="https://github.com/MarsLuay/GatorGuide.git"
LOG_PREFIX="[Course-Planner-Updater]"
BACK_EXIT_CODE="86"
INTERACTIVE_MENU="0"
HOSTED_BACK_TARGET=""

SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd)"
APP_BUNDLE_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd -- "$APP_BUNDLE_DIR/.." && pwd)"
APP_ROOT="$REPO_ROOT/source"
SCRIPT_ROOT="$APP_ROOT/scripts"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export PATH

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$*"
}

fail() {
  printf '%s %s\n' "$LOG_PREFIX" "$*" >&2
  exit 1
}

ensure_node() {
  if command_exists node && command_exists npm; then
    log "Node.js is already installed."
    return
  fi

  case "$(detect_os)" in
    Darwin)
      if command_exists brew; then
        log "Node.js was not found. Installing Node.js with Homebrew..."
        brew install node
      else
        fail "Node.js is missing and Homebrew is not installed. Install Node from https://nodejs.org and run this launcher again."
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
        fail "Node.js is missing and no supported package manager was found. Install Node from https://nodejs.org and run this launcher again."
      fi
      ;;
    *)
      fail "Unsupported OS: $(detect_os)"
      ;;
  esac

  command_exists node || fail "Node.js installation finished, but 'node' is still unavailable in this shell."
  log "Node.js finished installing successfully."
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
  if [ -f "$APP_ROOT/package.json" ]; then
    return
  fi

  local clone_root="$REPO_ROOT/$REPO_DIR_NAME"
  if [ -f "$clone_root/source/package.json" ]; then
    REPO_ROOT="$clone_root"
    APP_ROOT="$REPO_ROOT/source"
    SCRIPT_ROOT="$APP_ROOT/scripts"
    log "Found Gator Guide in \"$REPO_ROOT\"."
    return
  fi

  log "Gator Guide was not found next to this launcher."
  ensure_git

  if [ -e "$clone_root" ]; then
    fail "Cannot clone into \"$clone_root\" because that path already exists. Move or remove it, or place this launcher next to a full GatorGuide checkout."
  fi

  log "Cloning Gator Guide into \"$clone_root\"..."
  git clone "$REPO_URL" "$clone_root"

  REPO_ROOT="$clone_root"
  APP_ROOT="$REPO_ROOT/source"
  SCRIPT_ROOT="$APP_ROOT/scripts"
  [ -f "$APP_ROOT/package.json" ] || fail "The repo finished cloning, but \"$APP_ROOT/package.json\" is still missing."
  log "Repo cloned successfully."
}

free_memory_mb() {
  case "$(detect_os)" in
    Darwin)
      local page_size
      page_size="$(pagesize 2>/dev/null || printf '4096')"
      /usr/bin/vm_stat 2>/dev/null | awk -v ps="$page_size" '
        /Pages free/ { gsub("\\.","",$3); free=$3 }
        /Pages speculative/ { gsub("\\.","",$3); spec=$3 }
        END { print int((free + spec) * ps / 1024 / 1024) }
      '
      ;;
    Linux)
      awk '/MemAvailable:/ { print int($2 / 1024); found=1 } END { if (!found) print 9999 }' /proc/meminfo 2>/dev/null
      ;;
    *)
      printf '9999\n'
      ;;
  esac
}

find_powershell() {
  local free_mb
  free_mb="$(free_memory_mb 2>/dev/null || printf '9999')"
  if [ "$free_mb" -lt 200 ] 2>/dev/null; then
    log "Free memory ~${free_mb}MB is critically low; skipping PowerShell/CoreCLR and using Node."
    return 1
  fi

  if command_exists pwsh; then
    if pwsh -NoProfile -Command 'exit 0' >/dev/null 2>&1; then
      printf '%s\n' "pwsh"
      return 0
    fi
    log "pwsh is installed but cannot start (often low memory / CoreCLR). Falling back to Node maintenance."
  fi

  if command_exists powershell; then
    if powershell -NoProfile -ExecutionPolicy Bypass -Command 'exit 0' >/dev/null 2>&1; then
      printf '%s\n' "powershell"
      return 0
    fi
    log "powershell is installed but cannot start. Falling back to Node maintenance."
  fi

  return 1
}

run_node_maintenance() {
  ensure_node
  local skip_downloads="${1:-}"
  local mode="${2:-}"
  local skip_verify="${3:-}"
  local -a node_args=()

  if [ "$skip_downloads" = "skip-downloads" ]; then
    node_args+=(--skip-downloads)
  fi
  if [ "$mode" = "refresh-only" ]; then
    node_args+=(--refresh-only)
    if [ "$skip_verify" = "skip-verify" ]; then
      node_args+=(--skip-verify)
    fi
  fi

  if [ "${#node_args[@]}" -eq 0 ]; then
    node "$SCRIPT_ROOT/run-transfer-planner-maintenance.cjs"
  else
    node "$SCRIPT_ROOT/run-transfer-planner-maintenance.cjs" "${node_args[@]}"
  fi
}

run_powershell_file() {
  local shell_path
  if ! shell_path="$(find_powershell)"; then
    return 90
  fi
  if [ "$(basename "$shell_path")" = "powershell" ]; then
    "$shell_path" -NoProfile -ExecutionPolicy Bypass -File "$@"
  else
    "$shell_path" -NoProfile -File "$@"
  fi
}

pause_for_enter() {
  printf 'Press Enter to continue...'
  IFS= read -r _
}

organize_tmp() {
  if [ -f "$APP_ROOT/scripts/organize-tmp-artifacts.cjs" ] && command_exists node; then
    node "$APP_ROOT/scripts/organize-tmp-artifacts.cjs" --quiet >/dev/null 2>&1 || true
  fi
}

finish() {
  local exit_code="$1"
  local action_label="$2"

  organize_tmp

  if [ "$exit_code" = "$BACK_EXIT_CODE" ] && [ -n "$HOSTED_BACK_TARGET" ]; then
    local target="$HOSTED_BACK_TARGET"
    HOSTED_BACK_TARGET=""
    "$target"
    return
  fi

  printf '\n'
  if [ "$exit_code" = "0" ]; then
    printf '%s finished successfully.\n' "$action_label"
  else
    printf '%s failed with exit code %s.\n' "$action_label" "$exit_code"
  fi
  printf '\n'
  pause_for_enter

  if [ "$INTERACTIVE_MENU" = "1" ]; then
    menu
    return
  fi

  exit "$exit_code"
}

run_maintenance() {
  local action_label="Course planner maintenance"
  local exit_code
  set +e
  if [ -z "$HOSTED_BACK_TARGET" ]; then
    run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -NoPrompt -RunPostChecks
  else
    run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -NoPrompt -RunPostChecks -BackExitCode "$BACK_EXIT_CODE"
  fi
  exit_code="$?"
  if [ "$exit_code" = "90" ] || [ "$exit_code" = "137" ]; then
    log "Using Node maintenance runner (PowerShell unavailable)."
    run_node_maintenance
    exit_code="$?"
  fi
  set -e
  finish "$exit_code" "$action_label"
}

run_maintenance_no_downloads() {
  local action_label="Course planner maintenance (skip downloads)"
  local exit_code
  set +e
  if [ -z "$HOSTED_BACK_TARGET" ]; then
    run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -SkipDownloads -NoPrompt -RunPostChecks
  else
    run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -SkipDownloads -NoPrompt -RunPostChecks -BackExitCode "$BACK_EXIT_CODE"
  fi
  exit_code="$?"
  if [ "$exit_code" = "90" ] || [ "$exit_code" = "137" ]; then
    log "Using Node maintenance runner (PowerShell unavailable)."
    run_node_maintenance skip-downloads
    exit_code="$?"
  fi
  set -e
  finish "$exit_code" "$action_label"
}

run_refresh() {
  local exit_code
  set +e
  run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-refresh.ps1" -SkipVerify
  exit_code="$?"
  if [ "$exit_code" = "90" ] || [ "$exit_code" = "137" ]; then
    log "Using Node refresh runner (PowerShell unavailable)."
    run_node_maintenance "" refresh-only skip-verify
    exit_code="$?"
  fi
  set -e
  finish "$exit_code" "Course planner refresh"
}

run_refresh_no_downloads() {
  local exit_code
  set +e
  run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-refresh.ps1" -SkipDownloads -SkipVerify
  exit_code="$?"
  if [ "$exit_code" = "90" ] || [ "$exit_code" = "137" ]; then
    log "Using Node refresh runner (PowerShell unavailable)."
    run_node_maintenance skip-downloads refresh-only skip-verify
    exit_code="$?"
  fi
  set -e
  finish "$exit_code" "Course planner refresh (skip downloads)"
}

run_cache_summary() {
  local exit_code
  set +e
  run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -ShowCacheSummary -NoPrompt -NoOpenSummary
  exit_code="$?"
  if [ "$exit_code" = "90" ] || [ "$exit_code" = "137" ]; then
    log "Cache summary still requires PowerShell. Free memory or install a working pwsh, then retry."
    exit_code=1
  fi
  set -e
  finish "$exit_code" "Course planner cache summary"
}

run_edit_course_links() {
  local action_label="Edit course links"
  local exit_code
  set +e
  if [ -z "$HOSTED_BACK_TARGET" ]; then
    run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -EditCourseLinks
  else
    run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -EditCourseLinks -BackExitCode "$BACK_EXIT_CODE"
  fi
  exit_code="$?"
  if [ "$exit_code" = "90" ] || [ "$exit_code" = "137" ]; then
    log "Edit course links still requires PowerShell. Free memory or install a working pwsh, then retry."
    exit_code=1
  fi
  set -e
  finish "$exit_code" "$action_label"
}

run_laymans_diagnosis() {
  local exit_code
  set +e
  run_powershell_file "$SCRIPT_ROOT/run-transfer-planner-maintenance.ps1" -ShowLaymansDiagnosis -NoPrompt
  exit_code="$?"
  if [ "$exit_code" = "90" ] || [ "$exit_code" = "137" ]; then
    log "Laymans Diagnosis still requires PowerShell. Free memory or install a working pwsh, then retry."
    exit_code=1
  fi
  set -e
  finish "$exit_code" "Laymans Diagnosis"
}

run_fact_check_export() {
  local exit_code
  ensure_node
  set +e
  node "$APP_ROOT/scripts/planner/export-transfer-planner-fact-check.cjs"
  exit_code="$?"
  set -e
  finish "$exit_code" "Course planner row document export"
}

maintenance_mode_menu() {
  while :; do
    printf '\n'
    printf 'Course updates + tests\n'
    printf '1. Normal\n'
    printf '2. Skip downloads\n'
    printf 'B. Back\n'
    printf '\n'
    printf 'Enter 1-2 or B:'
    IFS= read -r CHOICE

    case "$CHOICE" in
      1)
        HOSTED_BACK_TARGET="maintenance_mode_menu"
        run_maintenance
        return
        ;;
      2)
        HOSTED_BACK_TARGET="maintenance_mode_menu"
        run_maintenance_no_downloads
        return
        ;;
      [Bb])
        menu
        return
        ;;
      *)
        printf 'Enter 1, 2, or B.\n'
        ;;
    esac
  done
}

refresh_mode_menu() {
  while :; do
    printf '\n'
    printf 'Course updates only\n'
    printf '1. Normal\n'
    printf '2. Skip downloads\n'
    printf 'B. Back\n'
    printf '\n'
    printf 'Enter 1-2 or B:'
    IFS= read -r CHOICE

    case "$CHOICE" in
      1)
        run_refresh
        return
        ;;
      2)
        run_refresh_no_downloads
        return
        ;;
      [Bb])
        menu
        return
        ;;
      *)
        printf 'Enter 1, 2, or B.\n'
        ;;
    esac
  done
}

menu() {
  while :; do
    HOSTED_BACK_TARGET=""
    printf '\n'
    printf 'Course Planner Updater\n'
    printf '1. Course updates + tests\n'
    printf '2. Course updates only\n'
    printf '3. Show cache summary\n'
    printf '4. Edit course links\n'
    printf '5. Laymans Diagnosis\n'
    printf '6. Export course planner row document\n'
    printf '7. Back\n'
    printf '\n'
    printf 'Enter 1-7:'
    IFS= read -r CHOICE

    case "$CHOICE" in
      1)
        maintenance_mode_menu
        return
        ;;
      2)
        refresh_mode_menu
        return
        ;;
      3)
        run_cache_summary
        return
        ;;
      4)
        HOSTED_BACK_TARGET="menu"
        run_edit_course_links
        return
        ;;
      5)
        run_laymans_diagnosis
        return
        ;;
      6)
        run_fact_check_export
        return
        ;;
      7)
        exit 0
        ;;
      *)
        printf 'Enter a number from 1 to 7.\n'
        ;;
    esac
  done
}

print_help() {
  cat <<'USAGE'
Usage:
  Course-Planner-Updater.app
  Course-Planner-Updater.desktop
  course-planner-updater.sh maintenance
  course-planner-updater.sh maintenance-no-downloads
  course-planner-updater.sh refresh
  course-planner-updater.sh refresh-no-downloads
  course-planner-updater.sh cache-summary
  course-planner-updater.sh edit-course-links
  course-planner-updater.sh laymans-diagnosis
  course-planner-updater.sh export-fact-check
  course-planner-updater.sh help
USAGE
}

main() {
  locate_or_clone_repo
  cd "$APP_ROOT"

  local mode="${1:-}"
  case "$mode" in
    maintenance)
      run_maintenance
      ;;
    maintenance-no-downloads)
      run_maintenance_no_downloads
      ;;
    refresh)
      run_refresh
      ;;
    refresh-no-downloads)
      run_refresh_no_downloads
      ;;
    cache-summary)
      run_cache_summary
      ;;
    edit-course-links)
      run_edit_course_links
      ;;
    laymans-diagnosis)
      run_laymans_diagnosis
      ;;
    export-fact-check)
      run_fact_check_export
      ;;
    help)
      print_help
      exit 0
      ;;
    "")
      INTERACTIVE_MENU="1"
      menu
      ;;
    *)
      printf 'Unknown mode "%s".\n\n' "$mode" >&2
      print_help
      exit 1
      ;;
  esac
}

main "$@"
)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  printf '\nCourse Planner Updater failed with exit code %s.\n' "$STATUS" >&2
  printf 'Press Enter to close this window...'
  IFS= read -r _
fi

exit "$STATUS"
