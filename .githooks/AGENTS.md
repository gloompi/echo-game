# Git hooks

Inherit the root contract. Keep hooks executable, LF-terminated, minimal POSIX shell launchers for the tested Node implementation. Do not duplicate verification commands here.

Pre-commit verifies a fully staged working tree; pre-push verifies clean HEAD and refuses pushing another commit. No automatic stash, reset, or rewriting staged files. Existing custom hooks are preserved by the installer and must explicitly chain the Echo hook if desired. Hooks are bypassable; required CI is the enforcement layer.
