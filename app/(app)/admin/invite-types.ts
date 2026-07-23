export type InviteResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "assigned"; message: string }
  | { status: "created"; email: string; tempPassword: string };

export const INITIAL_INVITE_RESULT: InviteResult = { status: "idle" };

export type ResetResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "reset"; tempPassword: string };

export const INITIAL_RESET_RESULT: ResetResult = { status: "idle" };
