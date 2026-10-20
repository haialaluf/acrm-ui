import { useAccess } from "@/hooks/useAccess";
import { useInvitations } from "@/queries/useAgents";
import { useOrganizations } from "@/queries/useOrganizations";
import useBoundStore from "@/stores/useBoundStore";

export const NEW_ORGANIZATION_PATH = "/settings/organization/new";

const INVITATION_POLL_INTERVAL = 15_000;

export type OnboardingStep = "organization" | "integration";

/**
 * While onboarding, the app shrinks to the few sections that move the user
 * forward: the nav rail shows only those, and the shell redirects everything
 * else to `homePath`. Messages is kept whenever an invitation is pending,
 * because that is where it is accepted.
 */
export function useOnboarding() {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);
  const { data: organizations, isPending: isOrganizationsPending } =
    useOrganizations();
  const { allows, isResolved: isAccessResolved } = useAccess();

  // Keyed on `activeOrgId` too: right after creating an organization it is set
  // before the organizations list refetches, and that window must not bounce
  // the user back to the create form.
  const step: OnboardingStep | null =
    !activeOrgId && organizations?.length === 0
      ? "organization"
      : activeOrgId && isAccessResolved && !allows("app.connected")
        ? "integration"
        : null;

  // Polled while waiting on an admin, so an invitation sent meanwhile shows up
  // without a reload, as the onboarding copy promises.
  const { data: invitations, isPending: isInvitationsPending } = useInvitations(
    {
      refetchInterval: step === "organization" && INVITATION_POLL_INTERVAL,
    },
  );
  const hasInvitations = !!invitations?.length;

  const sections =
    step === "organization"
      ? [NEW_ORGANIZATION_PATH]
      : step === "integration"
        ? ["/integrations", "/settings"]
        : [];
  if (step && hasInvitations) sections.push("/conversations");

  const homePath =
    step === "organization"
      ? hasInvitations
        ? "/conversations"
        : NEW_ORGANIZATION_PATH
      : "/integrations";

  // `step` reads null both when onboarding is over and when it is not known
  // yet. Until it is known, `shows` hides everything, the way
  // `HideIfNotPermitted` does: a menu item appearing a beat late is invisible,
  // one appearing and then vanishing on refresh is not. `isPending` rather than
  // `data`, so a failed query does not leave the menu empty for good.
  const isResolved =
    !isOrganizationsPending &&
    !isInvitationsPending &&
    (!activeOrgId || isAccessResolved);

  return {
    step,
    hasInvitations,
    isResolved,
    homePath,
    shows: (section: string) =>
      isResolved && (!step || sections.includes(section)),
    showsEverything: isResolved && !step,
    isAllowedPath: (pathname: string) =>
      !step ||
      sections.some(
        (section) => pathname === section || pathname.startsWith(section + "/"),
      ),
  };
}
