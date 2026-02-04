---
name: ssh-acces
description: Agent has access to ssh
---

# SSH Access to Home Assistant Pi

## Connection

```bash
ssh root@homeassistant.local
```

No password required - authentication uses SSH keys.

## Important: Sandbox Permissions

When using the Shell tool to SSH, you **must** use `required_permissions: ["all"]`.

The `.local` domain uses mDNS/Bonjour for name resolution, which requires multicast network access. The `["network"]` permission alone is insufficient and will fail with:

```
getnameinfo failed: Non-recoverable failure in name resolution
```

Always use:

```javascript
required_permissions: ["all"]
```
