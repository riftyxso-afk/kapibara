import type { ActionCategory, ActionClassification, ActionId, PreflightInput } from "./types.js";

export interface FactorBase {
  destructive: number;
  reversibility: number;
  sensitive: number;
  external: number;
  production: number;
  uncertainty: number;
}

export interface ActionProfile {
  category: ActionCategory;
  label: string;
  description: string;
  destructive: boolean;
  external: boolean;
  reversible: boolean;
  factors: FactorBase;
}

const PROFILES: Record<ActionId, ActionProfile> = {
  read_file: {
    category: "read",
    label: "Read a file",
    description: "Read-only access without side effects.",
    destructive: false,
    external: false,
    reversible: true,
    factors: {
      destructive: 0,
      reversibility: 0,
      sensitive: 0,
      external: 0,
      production: 0,
      uncertainty: 2,
    },
  },
  modify_local_file: {
    category: "modify",
    label: "Modify a local file",
    description: "Change a local file without an external side effect.",
    destructive: false,
    external: false,
    reversible: true,
    factors: {
      destructive: 10,
      reversibility: 8,
      sensitive: 0,
      external: 0,
      production: 0,
      uncertainty: 8,
    },
  },
  delete_file: {
    category: "delete",
    label: "Delete a file",
    description: "Remove a local file or resource.",
    destructive: true,
    external: false,
    reversible: false,
    factors: {
      destructive: 12,
      reversibility: 12,
      sensitive: 0,
      external: 0,
      production: 0,
      uncertainty: 4,
    },
  },
  recursive_delete: {
    category: "delete",
    label: "Recursive or broad deletion",
    description: "Delete many files or a whole directory tree.",
    destructive: true,
    external: false,
    reversible: false,
    factors: {
      destructive: 25,
      reversibility: 20,
      sensitive: 0,
      external: 0,
      production: 0,
      uncertainty: 10,
    },
  },
  overwrite_file: {
    category: "modify",
    label: "Overwrite a file",
    description: "Replace an existing file or its contents.",
    destructive: true,
    external: false,
    reversible: false,
    factors: {
      destructive: 12,
      reversibility: 10,
      sensitive: 0,
      external: 0,
      production: 0,
      uncertainty: 8,
    },
  },
  commit: {
    category: "outbound",
    label: "Create a commit",
    description: "Record local changes in version control.",
    destructive: false,
    external: true,
    reversible: true,
    factors: {
      destructive: 2,
      reversibility: 8,
      sensitive: 0,
      external: 6,
      production: 0,
      uncertainty: 4,
    },
  },
  git_push: {
    category: "outbound",
    label: "Push to a Git remote",
    description: "Publish commits to a shared remote.",
    destructive: false,
    external: true,
    reversible: false,
    factors: {
      destructive: 8,
      reversibility: 10,
      sensitive: 0,
      external: 8,
      production: 0,
      uncertainty: 6,
    },
  },
  git_force_push: {
    category: "outbound",
    label: "Force push",
    description: "Rewrite remote Git history.",
    destructive: true,
    external: true,
    reversible: false,
    factors: {
      destructive: 20,
      reversibility: 20,
      sensitive: 0,
      external: 10,
      production: 0,
      uncertainty: 8,
    },
  },
  deploy: {
    category: "deploy",
    label: "Deploy",
    description: "Release software to an environment.",
    destructive: false,
    external: true,
    reversible: false,
    factors: {
      destructive: 14,
      reversibility: 14,
      sensitive: 0,
      external: 8,
      production: 4,
      uncertainty: 8,
    },
  },
  deploy_production: {
    category: "deploy",
    label: "Deploy to production",
    description: "Release software to a production environment.",
    destructive: true,
    external: true,
    reversible: false,
    factors: {
      destructive: 14,
      reversibility: 16,
      sensitive: 0,
      external: 8,
      production: 10,
      uncertainty: 8,
    },
  },
  publish: {
    category: "outbound",
    label: "Publish",
    description: "Make content public or available outside the workspace.",
    destructive: false,
    external: true,
    reversible: false,
    factors: {
      destructive: 8,
      reversibility: 16,
      sensitive: 10,
      external: 12,
      production: 0,
      uncertainty: 6,
    },
  },
  upload: {
    category: "outbound",
    label: "Upload",
    description: "Send content to an external destination.",
    destructive: false,
    external: true,
    reversible: false,
    factors: {
      destructive: 8,
      reversibility: 16,
      sensitive: 10,
      external: 10,
      production: 0,
      uncertainty: 6,
    },
  },
  share: {
    category: "outbound",
    label: "Share",
    description: "Share content with another person or service.",
    destructive: false,
    external: true,
    reversible: false,
    factors: {
      destructive: 8,
      reversibility: 16,
      sensitive: 10,
      external: 12,
      production: 0,
      uncertainty: 6,
    },
  },
  send_email: {
    category: "outbound",
    label: "Send an external message",
    description: "Send an email or message outside the local environment.",
    destructive: false,
    external: true,
    reversible: false,
    factors: {
      destructive: 6,
      reversibility: 12,
      sensitive: 4,
      external: 12,
      production: 0,
      uncertainty: 6,
    },
  },
  drop_database: {
    category: "database",
    label: "Drop a database object",
    description: "Destroy a database, schema, or table.",
    destructive: true,
    external: false,
    reversible: false,
    factors: {
      destructive: 25,
      reversibility: 20,
      sensitive: 12,
      external: 0,
      production: 4,
      uncertainty: 8,
    },
  },
  truncate_database: {
    category: "database",
    label: "Truncate a database table",
    description: "Remove database rows without a routine undo.",
    destructive: true,
    external: false,
    reversible: false,
    factors: {
      destructive: 25,
      reversibility: 20,
      sensitive: 12,
      external: 0,
      production: 4,
      uncertainty: 8,
    },
  },
  database_migration: {
    category: "database",
    label: "Run a database migration",
    description: "Change database structure or data.",
    destructive: false,
    external: false,
    reversible: false,
    factors: {
      destructive: 18,
      reversibility: 18,
      sensitive: 4,
      external: 0,
      production: 4,
      uncertainty: 10,
    },
  },
  purchase: {
    category: "financial",
    label: "Make a purchase or transfer",
    description: "Move money or create a financial obligation.",
    destructive: true,
    external: true,
    reversible: false,
    factors: {
      destructive: 8,
      reversibility: 18,
      sensitive: 4,
      external: 10,
      production: 0,
      uncertainty: 6,
    },
  },
  permission_change: {
    category: "permission",
    label: "Change permissions",
    description: "Change access control, roles, or ownership.",
    destructive: true,
    external: false,
    reversible: false,
    factors: {
      destructive: 14,
      reversibility: 12,
      sensitive: 0,
      external: 8,
      production: 4,
      uncertainty: 8,
    },
  },
  execute_shell: {
    category: "execute",
    label: "Execute a shell command",
    description: "Run a command with access to the local environment.",
    destructive: true,
    external: false,
    reversible: false,
    factors: {
      destructive: 16,
      reversibility: 14,
      sensitive: 0,
      external: 4,
      production: 0,
      uncertainty: 10,
    },
  },
  unknown: {
    category: "unknown",
    label: "Unclassified action",
    description: "The action could not be classified confidently.",
    destructive: false,
    external: false,
    reversible: false,
    factors: {
      destructive: 6,
      reversibility: 8,
      sensitive: 0,
      external: 0,
      production: 0,
      uncertainty: 10,
    },
  },
};

function normalizeAction(action: string): string {
  return action.toLowerCase().replace(/[–—]/g, "-").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function productionHint(input: PreflightInput): boolean {
  const target = input.target ?? "";
  const environment = input.context?.environment ?? "";
  return (
    input.context?.production === true ||
    /\b(prod|production)\b/i.test(input.action.replace(/_/g, " ")) ||
    /\b(prod|production)\b/i.test(environment) ||
    /\b(prod|production)\b/i.test(target)
  );
}

function metadataString(input: PreflightInput, key: string): string {
  const value = input.context?.metadata?.[key];
  return typeof value === "string" ? value : "";
}

const DELETE_VERB = /\b(delete|remove|rm|unlink|erase|destroy|wipe|purge)\b/;

/**
 * Action ids that are more specific than "run a shell command". When a generic
 * shell or unclassified action wraps one of these commands, the wrapped command
 * wins so that wrapping cannot be used to downgrade a check.
 */
const WRAPPED_COMMAND_IDS = new Set<ActionId>([
  "git_force_push",
  "git_push",
  "recursive_delete",
  "delete_file",
  "overwrite_file",
  "drop_database",
  "truncate_database",
  "database_migration",
  "deploy",
  "deploy_production",
  "publish",
  "upload",
  "share",
  "send_email",
  "purchase",
  "permission_change",
]);

function matchActionId(input: PreflightInput): ActionId {
  const action = normalizeAction(input.action);
  const compact = action.replace(/[^a-z0-9]+/g, "");
  const target = input.target ?? "";
  const command = metadataString(input, "command");
  const combined = `${action} ${target} ${command}`.toLowerCase();
  const hasDeleteVerb = DELETE_VERB.test(action);

  let id: ActionId = "unknown";

  if (
    compact.includes("forcepush") ||
    (/\bforce\b/.test(action) && /\bpush\b/.test(action)) ||
    /\bpush\b.*(?:--force|-f)\b/.test(action)
  ) {
    id = "git_force_push";
  } else if (
    /(?:delete|drop|truncate|wipe|destroy).*(database|db|table|schema)/.test(action) ||
    /(?:database|db|table|schema).*(?:delete|drop|truncate|wipe|destroy)/.test(action)
  ) {
    id = /\btruncate\b/.test(action) ? "truncate_database" : "drop_database";
  } else if (
    compact.includes("recursivedelete") ||
    compact.includes("rmrf") ||
    /\brm\s+-[a-z]*r/.test(action) ||
    /\bfind\b.*\b-delete\b/.test(action) ||
    /\bgit\s+clean\b/.test(action) ||
    /\b(delete|remove)\b.*\b(directory|folder|tree)\b/.test(action) ||
    /\b(delete|remove)\b.*\ball\b/.test(action) ||
    (hasDeleteVerb && (input.context?.metadata?.recursive === true || /\/$/.test(target)))
  ) {
    id = "recursive_delete";
  } else if (/\b(migration|migrate)\b/.test(action) || /\bmigration\b/.test(target)) {
    id = "database_migration";
  } else if (/\b(publish|release\s+package)\b/.test(action)) {
    id = "publish";
  } else if (/\b(deploy|deployment|release|ship)\b/.test(action)) {
    id = productionHint(input) ? "deploy_production" : "deploy";
  } else if (
    /\b(send|post)\b.*\b(email|message|slack|telegram|whatsapp|sms)\b/.test(action) ||
    /\bemail\b/.test(action)
  ) {
    id = "send_email";
  } else if (/\bupload\b/.test(action)) {
    id = "upload";
  } else if (/\bshare\b/.test(action)) {
    id = "share";
  } else if (/\bcommit\b/.test(action) || compact.includes("gitadd")) {
    id = "commit";
  } else if (/\bpush\b/.test(action)) {
    id = "git_push";
  } else if (/\b(purchase|buy|pay|payment|transfer)\b/.test(action)) {
    id = "purchase";
  } else if (/\b(chmod|chown|permission|permissions|acl|role|sudo)\b/.test(action)) {
    id = "permission_change";
  } else if (/\b(execute|exec|shell|bash|zsh|terminal|command|script|run)\b/.test(action)) {
    id = "execute_shell";
  } else if (/\b(overwrite|replace)\b/.test(action)) {
    id = "overwrite_file";
  } else if (/\b(delete|remove|rm|unlink|erase|destroy)\b/.test(action)) {
    id = "delete_file";
  } else if (/\b(modify|change|edit|update|write|create|patch)\b/.test(action)) {
    id = "modify_local_file";
  } else if (/\b(read|view|cat|list|search|grep|find|inspect|open|show|stat)\b/.test(action)) {
    id = "read_file";
  }

  if (id === "unknown" && /\b(status|diff|log)\b/.test(action) && /\bgit\b/.test(combined)) {
    id = "read_file";
  }

  return id;
}

export function classifyAction(input: PreflightInput): ActionClassification {
  let id = matchActionId(input);

  if (id === "execute_shell" || id === "unknown") {
    const command =
      metadataString(input, "command") || (id === "execute_shell" ? (input.target ?? "") : "");
    if (command.trim()) {
      const wrapped = matchActionId({ ...input, action: command });
      if (WRAPPED_COMMAND_IDS.has(wrapped)) {
        id = wrapped;
      }
    }
  }

  if (
    id === "execute_shell" &&
    /\brm\s+-r|\bgit\s+clean\b|\bdrop\s+(?:database|table)\b|\btruncate\b/.test(
      metadataString(input, "command"),
    )
  ) {
    id = "recursive_delete";
  }

  const profile = PROFILES[id];
  return {
    id,
    category: profile.category,
    label: profile.label,
    description: profile.description,
    destructive: profile.destructive,
    external: profile.external,
    reversible: profile.reversible,
  };
}

export function getActionFactors(id: ActionId): FactorBase {
  return { ...PROFILES[id].factors };
}

export function getActionProfile(id: ActionId): ActionProfile {
  return { ...PROFILES[id], factors: { ...PROFILES[id].factors } };
}

export function isOutboundAction(id: ActionId): boolean {
  const category = PROFILES[id].category;
  return category === "outbound" || category === "deploy";
}

export const ACTION_IDS = Object.keys(PROFILES) as ActionId[];
