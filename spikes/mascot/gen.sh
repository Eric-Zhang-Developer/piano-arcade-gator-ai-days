#!/usr/bin/env bash
# One image from the codex CLI's image tool (spec: mascot-spike): gen.sh <out-name.png> <prompt-file> [reference.png]
# Saves to spikes/mascot/out/<out-name.png> and appends the prompt as sent, the reference and the file to prompts.md.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/out"
name="$1"; prompt_file="$2"; ref="${3:-}"
prompt="$(cat "$prompt_file")"
args=(exec -s workspace-write -C "$out" --skip-git-repo-check)
[ -n "$ref" ] && args+=(-i "$ref")
msg="Use your image generation tool to create ONE image and save it in the current directory as $name. Do nothing else: no code, no other files.${ref:+ The attached image is the character reference: keep this exact character (head shape, eyes, snout, proportions, colors, bow tie).}

$prompt"
start=$(date +%s)
codex "${args[@]}" "$msg" > "$out/${name%.png}.log" 2>&1
status=$?
secs=$(( $(date +%s) - start ))
{
  printf '\n## %s\n' "$name"
  printf -- '- reference: %s\n' "${ref:+$(basename "$ref")}"
  printf -- '- result: %s, %ss\n' "$([ -f "$out/$name" ] && echo "saved" || echo "MISSING (codex exit $status, see out/${name%.png}.log)")" "$secs"
  printf '\n```\n%s\n```\n' "$msg"
} >> "$here/prompts.md"
[ -f "$out/$name" ]
