import { isCompanyAccount, requireUser, jsonError } from "@/lib/auth";
import { findCompanyByUserId } from "@/lib/company";
import {
  countActiveEnrollmentsByModality,
  listActiveRankings,
  MAX_MONTHLY_ENROLLMENTS,
  MAX_WEEKLY_ENROLLMENTS,
  sumPointsAcrossActiveEnrollments,
} from "@/lib/rankings";

export async function GET(request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get("cityId");
    const mineCity = searchParams.get("mineCity") === "1";
    const filterCityId = mineCity
      ? user.city_id
      : cityId != null && cityId !== ""
        ? Number(cityId)
        : undefined;

    let sponsorCompanyId;
    if (isCompanyAccount(user)) {
      const company = await findCompanyByUserId(user.id);
      if (!company) {
        return Response.json({
          items: [],
          pointsAccumulated: 0,
          myCity: null,
          companyScope: true,
          limits: null,
        });
      }
      sponsorCompanyId = company.id;
    }

    const items = await listActiveRankings(user.id, {
      cityId: sponsorCompanyId ? undefined : filterCityId,
      preferCityId: sponsorCompanyId ? null : user.city_id ?? null,
      sponsorCompanyId,
    });

    if (sponsorCompanyId) {
      return Response.json({
        items,
        pointsAccumulated: 0,
        myCity: null,
        companyScope: true,
        limits: null,
      });
    }

    const pointsAccumulated = await sumPointsAcrossActiveEnrollments(user.id);
    const weeklyUsed = await countActiveEnrollmentsByModality(
      null,
      user.id,
      "weekly"
    );
    const monthlyUsed = await countActiveEnrollmentsByModality(
      null,
      user.id,
      "monthly"
    );

    return Response.json({
      items,
      pointsAccumulated,
      myCity: user.city_name
        ? {
            name: user.city_name,
            state: user.city_state || null,
          }
        : null,
      companyScope: false,
      limits: {
        weekly: { max: MAX_WEEKLY_ENROLLMENTS, used: weeklyUsed },
        monthly: { max: MAX_MONTHLY_ENROLLMENTS, used: monthlyUsed },
      },
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
