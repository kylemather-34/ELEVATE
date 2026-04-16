import * as vscode from "vscode";
import { Feedback } from "./SessionContext";
import { FileSnapshot } from "./FileSnapshot";

export interface ElevatePersistedState {
  recentFeedback: Feedback[];
  lastActiveFile?: FileSnapshot;
}

const STATE_KEY = "elevate.state";
const MAX_FEEDBACK = 50;

export function saveElevateState(
  context: vscode.ExtensionContext,
  state: ElevatePersistedState
): void {
  const capped: ElevatePersistedState = {
    ...state,
    recentFeedback: state.recentFeedback.slice(-MAX_FEEDBACK),
  };
  void context.globalState.update(STATE_KEY, capped);
}

export function loadElevateState(
  context: vscode.ExtensionContext
): ElevatePersistedState {
  return context.globalState.get<ElevatePersistedState>(STATE_KEY, {
    recentFeedback: [],
  });
}
