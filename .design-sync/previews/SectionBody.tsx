import { SectionBody, SectionItem, Avatar } from "acrm-ui";

export const WithRows = () => (
  <div style={{ height: 260, width: 420 }}>
    <SectionBody>
      {[
        { title: "Dana Levi", initials: "DL", description: "Thanks, see you Tuesday" },
        { title: "Yossi Mizrahi", initials: "YM", description: "Can we move the meeting?" },
        { title: "Noa Barak", initials: "NB", description: "Sent the invoice over" },
      ].map((r) => (
        <SectionItem
          key={r.title}
          title={r.title}
          description={r.description}
          aside={
            <Avatar
              fallback={r.initials}
              size={49}
              className="bg-accent text-accent-foreground border border-border text-[16px]"
            />
          }
          onClick={() => {}}
        />
      ))}
    </SectionBody>
  </div>
);
