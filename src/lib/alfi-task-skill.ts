import "server-only";

// Installed only in newly created Alfi Agent instances. It intentionally gives Hermes a small,
// local command surface instead of credentials or a remote URL.
export const ALFI_TASK_MANAGER_SKILL = `# Alfi Task Manager

Use the local \`alfi tasks\` command to manage the user's Minions tasks.

## Commands

- List tasks: \`alfi tasks list\`
- Show one task: \`alfi tasks show <task-id>\`
- Create: \`alfi tasks create --title "..." --description "..."\`
- Move: \`alfi tasks move <task-id> --status <status>\`
- Delete: \`alfi tasks delete <task-id> --yes\`

## Rules

- Always return the task ID when creating, showing, moving, or deleting a task.
- Allowed move statuses are exactly \`in_progress\`, \`in_review\`, and \`done\`.
- Before running \`alfi tasks delete <task-id> --yes\`, obtain explicit confirmation from the user in the current conversation. Do not infer confirmation from an earlier request.
- If the user asks for a status outside the allowed list, explain the available statuses and ask which one they want.
`;
