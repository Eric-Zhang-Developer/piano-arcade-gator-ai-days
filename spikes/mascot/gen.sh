#!/usr/bin/env bash
# One image from the codex CLI's image tool (spec: mascot-spike): gen.sh <out-name.png> <prompt-file> [reference.png]
# Saves to spikes/mascot/out/<out-name.png> and appends the prompt as sent, the reference and the file to prompts.md.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/out"
name="$1"; prompt_file="$2"; ref="${3:-}"
prompt="$(cat "$prompt_file")"
mkdir -p "$(dirname "$out/$name")"
args=(exec -s workspace-write -C "$out" --skip-git-repo-check)
[ -n "$ref" ] && args+=("--image=$ref") # = form: a bare -i is variadic and swallows the prompt
msg="Use your image generation tool to create ONE image and save it as $name (a path relative to the current directory). Do nothing else: no code, no other files.${ref:+ The attached image is the character reference: keep this exact character (head shape, eyes, snout, proportions, colors, bow tie).}

$prompt"
start=$(date +%s)
codex "${args[@]}" "$msg" > "$out/${name%.png}.log" 2>&1
status=$?
secs=$(( $(date +%s) - start ))
# One write per entry, so parallel runs don't interleave their entries.
entry="$(printf '\n## %s\n- reference: %s\n- result: %s, %ss\n\n```\n%s\n```\n' "$name" "${ref:+$(basename "$ref")}" \
  "$([ -f "$out/$name" ] && echo "saved" || echo "MISSING (codex exit $status, see out/${name%.png}.log)")" "$secs" "$msg")"
printf '%s\n' "$entry" >> "$here/prompts.md"
[ -f "$out/$name" ]
