import { PageHead, ComingSoon } from "@/components/PageHead";

export default function MapPage() {
  return (
    <>
      <PageHead
        title="Network Map"
        desc="State outlines with a glowing pin for each neighbornet, colored by current status."
      />
      <ComingSoon feature="The network map" />
    </>
  );
}
