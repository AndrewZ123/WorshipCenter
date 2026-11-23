/**
 * Whether the profile setup wizard should be shown.
 *
 * `setupCompleted` is the persisted "user skipped or finished setup" flag
 * (`profile_setup_completed_<userId>` in localStorage). Skip must stick:
 * once that flag is set the wizard stays closed, even if the user still has
 * no name. When setup has never been completed, first-run behavior applies
 * and the wizard opens regardless of whether a name already exists.
 */
export type ProfileSetupState = {
  /** Whether the signed-in user already has a display name. */
  hasName: boolean;
  /** Whether the user skipped or completed setup previously. */
  setupCompleted: boolean;
};

export function shouldOpenProfileSetup(state: ProfileSetupState): boolean {
  // `hasName` is intentionally not enough on its own: users who already have
  // a name but never saw setup should still get the wizard once.
  return !state.setupCompleted;
}
