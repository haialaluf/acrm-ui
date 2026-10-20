import { createFileRoute } from "@tanstack/react-router";
import ChatList from "@/components/ChatList";
import ChatSearch from "@/components/ChatSearch";
import Header from "@/components/Header";
import ChatFilter from "@/components/ChatFilter";
import ChatTagFilter from "@/components/ChatTagFilter";
import SectionItem from "@/components/SectionItem";
import Spinner from "@/components/Spinner";
import { Bell } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useInvitations, useUpdateAgent } from "@/queries/useAgents";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/queryKeys";
import { useOnboarding } from "@/hooks/useOnboarding";
import NoOrganizationNotice from "@/components/NoOrganizationNotice";
import NoIntegrationNotice from "@/components/NoIntegrationNotice";
import useBoundStore from "@/stores/useBoundStore";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/conversations/")({
  component: Conversations,
});

function Conversations() {
  const { translate: t } = useTranslation();
  const { data: invitations } = useInvitations();
  const queryClient = useQueryClient();
  const updateAgent = useUpdateAgent();
  const { step: onboardingStep, hasInvitations } = useOnboarding();
  const setActiveOrg = useBoundStore((state) => state.ui.setActiveOrg);
  const navigate = useNavigate();

  const roles: Record<string, string> = {
    super_admin: t("Super admin"),
    owner: t("Owner"),
    admin: t("Administrator"),
    member: t("Member"),
  };

  const handleInvitationAction = (
    invitation: { id: string; organization_id: string },
    status: "accepted" | "rejected",
  ) => {
    updateAgent.mutate(
      {
        id: invitation.id,
        extra: {
          invitation: {
            status,
          },
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.agents.invitations(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.organizations.all(),
          });
          // Otherwise a user still onboarding the current organization stays
          // locked out of the one they just joined.
          if (status === "accepted" && onboardingStep) {
            setActiveOrg(invitation.organization_id);
            void navigate({ to: "/conversations" });
          }
        },
      },
    );
  };

  return (
    <>
      <Header /> {/* height: 59 px */}
      {onboardingStep ? (
        <div className="pt-[10px] px-[10px]">
          {onboardingStep === "organization" ? (
            <NoOrganizationNotice hasInvitations={hasInvitations} />
          ) : (
            <NoIntegrationNotice integrationsLink />
          )}
        </div>
      ) : (
        <>
          <ChatSearch /> {/* height: 49 px */}
          <ChatFilter /> {/* height: 43 px */}
          <ChatTagFilter /> {/* hidden when no contact tags exist */}
        </>
      )}
      {invitations && invitations.length > 0 && (
        <div className="pt-[10px] pb-[5px] ps-[10px] pe-[20px] flex flex-col gap-[4px]">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="bg-primary/10 rounded-lg">
              <SectionItem
                className="h-[92px]"
                title={t("Pending invitation")}
                description={
                  <div className="flex flex-col gap-[6px] w-full">
                    <p>
                      {invitation.extra!.invitation!.organization_name} (
                      {roles[invitation.extra!.role || "member"]})
                    </p>
                    <div className="flex gap-[16px] justify-end">
                      {updateAgent.isPending ? (
                        <Spinner size={16} />
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              handleInvitationAction(invitation, "accepted")
                            }
                            className="font-bold text-primary/90 hover:text-primary cursor-pointer"
                          >
                            {t("Accept")}
                          </button>
                          <button
                            onClick={() =>
                              handleInvitationAction(invitation, "rejected")
                            }
                            className="font-bold text-muted-foreground/90 hover:text-muted-foreground cursor-pointer"
                          >
                            {t("Reject")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                }
                aside={
                  <div className="p-[8px]">
                    <Bell className="w-[24px] h-[24px] text-primary" />
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}
      {!onboardingStep && <ChatList />}
    </>
  );
}
