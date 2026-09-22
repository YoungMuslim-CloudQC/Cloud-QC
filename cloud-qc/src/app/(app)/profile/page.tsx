import { db } from "@/lib/db";
import { requireApprovedAny } from "@/lib/authz";
import { getRegionMap, getNeighbornetOptions } from "@/lib/queries";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { SendTestDigestButton } from "@/components/profile/SendTestDigestButton";

export default async function ProfilePage() {
  const me = await requireApprovedAny();
  const [user, regionMap, neighbornetOptions] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: me.id },
      select: {
        name: true,
        email: true,
        image: true,
        phone: true,
        theme: true,
        digestCadence: true,
        notificationChannel: true,
        smsConsent: true,
        homeRegion: true,
        homeSubArea: true,
        digestSubAreas: true,
        representingNeighbornetId: true,
      },
    }),
    getRegionMap(),
    getNeighbornetOptions(),
  ]);

  return (
    <>
      <div className="page-head">
        <div className="page-title">Profile</div>
        <div className="page-desc">
          Your contact info, photo, and how Cloud QC reaches you.
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <ProfileForm
          name={user.name || user.email || "Member"}
          image={user.image}
          phone={user.phone}
          theme={user.theme ?? "default"}
          digestCadence={user.digestCadence}
          notificationChannel={user.notificationChannel}
          smsConsent={user.smsConsent}
          homeRegion={user.homeRegion}
          homeSubArea={user.homeSubArea}
          digestSubAreas={user.digestSubAreas}
          regionMap={regionMap}
          representingNeighbornetId={user.representingNeighbornetId}
          isCoordinator={me.role === "COORDINATOR"}
          neighbornetOptions={neighbornetOptions}
        />
        {me.role === "ADMIN" && <SendTestDigestButton />}
      </div>
    </>
  );
}
