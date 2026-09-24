# Editable world assets

Inherit the root contract. Preserve editable source files, provenance, and the documented export pipeline. Do not treat generated meshes or render screenshots as authoritative collision data.

Keep gameplay colliders, navigation, portals, and exported identifiers consistent with shared map data. Avoid unnecessary binary churn. Validate exports with existing asset tests and real browser map checks. Art changes must preserve the requested game style unless explicitly directed otherwise.

New or remade characters, props and maps use `.agents/skills/echo-3d-assets/SKILL.md`: approved brief and references, pass-by-pass review renders, `scripts/blender/validate_glb.py`, then repository verification. Existing assets define technical contracts only, not the quality target.
