import express, { Request, Response, NextFunction, Router } from "express";
import moment from "moment-timezone"; // ← use timezone build
const router: Router = express.Router();

const ASIA_TZ = "Asia/Ulaanbaatar"; // pick one and be consistent

const tulburBodoy = async (
  tulburuud: any[],
  garakh: number,           // ms
  orson: number,            // ms
  undsenUne: number,
  undsenMin: boolean,
  dotorZogsoolMinut: number,
  zuruuMinut: number | undefined,
  zuvkhunMinutaar: boolean = false,
) => {
  let dun = 0;

  // total minutes parked (raw)
  const diff = Math.abs(garakh - orson);
  let niitMinut = zuruuMinut ?? Math.floor(diff / (1000 * 60));

  // seconds-of-day in fixed TZ
  const seconds = (t: number | string | Date) => {
    const m = moment(t).tz(ASIA_TZ);
    return m.hours() * 3600 + m.minutes() * 60 + m.seconds();
  };

  // Pick correct tier, then extend with blocks
  const tariffTootsokh = (tiers: any[], usedMin: number) => {
    if (!tiers?.length) return 0;

    // sort ascending by "minut"
    const v = [...tiers].sort((a, b) => (a.minut ?? 0) - (b.minut ?? 0));
    const m = Math.max(0, Math.floor(usedMin)); // guard negatives

    // find highest tier with minut <= m
    let baseTier = v[0];
    for (const t of v) {
      if ((t.minut ?? 0) <= m) baseTier = t;
      else break;
    }

    const step = undsenMin ? 30 : 60; // block size after base tier
    const over = Math.max(0, m - (baseTier.minut ?? 0));
    const overBlocks = Math.ceil(over / step);

    return (baseTier.tulbur ?? 0) + overBlocks * undsenUne;
  };

  const tulburuudTootsokh = async (
    orsonSec: number,
    garsanSec: number,
    gantsXuwiartai: boolean = false
  ) => {
    let tulbur = 0;

    for await (const x of tulburuud) {
      // window start / end seconds-of-day in fixed TZ
      const zStartSec = seconds(x.tsag?.[0]);
      const zEndSec   = seconds(x.tsag?.[1]);

      // Normalize tiers once
      const tiers = Array.isArray(x.tariff) ? x.tariff : [];

      // Window wraps midnight
      if (zEndSec < zStartSec) {
        const within =
          (orsonSec >= zStartSec && orsonSec <= 86400) ||
          (orsonSec >= 0 && orsonSec <= zEndSec) ||
          (garsanSec >= zStartSec && garsanSec <= 86400) ||
          (garsanSec >= 0 && garsanSec <= zEndSec) ||
          (orsonSec <= zStartSec && garsanSec >= zEndSec);

        if (!within) continue;

        // break into two parts if needed
        if (garsanSec <= zEndSec) {
          // ...crossed midnight into next day
          const mins = (garsanSec + (86400 - Math.min(orsonSec, zStartSec))) / 60;
          const t = tariffTootsokh(tiers, mins);
          if (t > 0) tulbur += t;
        } else {
          // stay until midnight only
          const mins = (86400 - Math.max(orsonSec, zStartSec)) / 60;
          const t = tariffTootsokh(tiers, mins);
          if (t > 0) tulbur += t;
        }
      } else {
        // Non-overnight window [zStartSec, zEndSec]
        if (zStartSec <= orsonSec && zEndSec >= orsonSec && zEndSec >= garsanSec) {
          // both times inside the same window
          const mins = Math.max(
            0,
            Math.floor(
              (gantsXuwiartai
                ? (zEndSec - orsonSec) + (garsanSec - zStartSec)
                : (garsanSec - orsonSec)
              ) / 60
            )
          );
          const t = tariffTootsokh(tiers, zuruuMinut ?? mins);
          if (t > 0) tulbur = t;
          break; // single window covers it
        } else if (zStartSec <= orsonSec && zEndSec >= orsonSec && zEndSec <= garsanSec) {
          // starts inside, exits after window end
          const mins = Math.max(0, Math.trunc(((zEndSec - orsonSec) / 60)));
          const t = tariffTootsokh(tiers, zuruuMinut ?? mins);
          if (t > 0) tulbur += t;
        } else if (orsonSec < zStartSec && zStartSec < garsanSec && zEndSec >= garsanSec) {
          // enters window then exits inside it
          const mins = Math.max(0, Math.floor((garsanSec - zStartSec) / 60));
          const t = tariffTootsokh(tiers, zuruuMinut ?? mins);
          if (t > 0) tulbur += t;
        } else if (orsonSec < zStartSec && zEndSec < garsanSec) {
          // fully covers the window
          const mins = Math.max(0, Math.floor((zEndSec - zStartSec) / 60));
          const t = tariffTootsokh(tiers, zuruuMinut ?? mins);
          if (t > 0) tulbur += t;
        }
      }
    }
    return tulbur;
  };

  // map to seconds-of-day (TZ-safe)
  let orsonSec  = seconds(orson);
  let garsanSec = seconds(garakh);

  // subtract indoor pause
  if (dotorZogsoolMinut > 0) {
    const niitSec = Math.max(0, (niitMinut - dotorZogsoolMinut) * 60);
    niitMinut = Math.max(0, niitMinut - dotorZogsoolMinut);
    if (niitMinut < 1440 && niitSec < garsanSec) {
      garsanSec = Math.max(0, garsanSec); // unchanged; just recompute start
      orsonSec = Math.max(0, garsanSec - niitSec);
    }
  }

  const gantsXuwiartai = Array.isArray(tulburuud) && tulburuud.length === 1;

  // Cross midnight (by clock-of-day)
  if (orsonSec > garsanSec) {
    let dun1 = 0, dun2 = 0;

    if (dotorZogsoolMinut > 0) {
      if (niitMinut < 1440) {
        const niitSec = niitMinut * 60;
        dun1 = await tulburuudTootsokh(86400 - niitSec, 86400);
      } else {
        const zurvv = (niitMinut % 1440) * 60;
        dun1 = await tulburuudTootsokh(86400 - zurvv, 86400);
      }
    } else {
      if (gantsXuwiartai) {
        // one tariff window; treat as a single span split at midnight
        dun1 = await tulburuudTootsokh(orsonSec, garsanSec, true);
        dun2 = 0;
      } else {
        dun1 = await tulburuudTootsokh(orsonSec, 86400);
        dun2 = await tulburuudTootsokh(0, garsanSec);
      }
    }

    if (niitMinut < 1440) {
      dun = dun1 + dun2;
    } else {
      const khonog = Math.trunc(niitMinut / 1440);
      const khonogDun = await tulburuudTootsokh(0, 86400);
      dun = khonogDun * khonog + dun1 + dun2;
    }
  } else {
    // same-day
    if (niitMinut < 1440) {
      if (!zuvkhunMinutaar) {
        dun = await tulburuudTootsokh(orsonSec, garsanSec);
      } else {
        const zurvv = (niitMinut % 1440) * 60;
        dun = await tulburuudTootsokh(86400 - zurvv, 86400);
      }
    } else {
      let dun1 = 0;
      if (dotorZogsoolMinut > 0) {
        const zurvv = (niitMinut % 1440) * 60;
        dun1 = await tulburuudTootsokh(86400 - zurvv, 86400);
      } else {
        dun1 = await tulburuudTootsokh(orsonSec, garsanSec);
      }
      const khonog = Math.trunc(niitMinut / 1440);
      const khonogDun = await tulburuudTootsokh(0, 86400);
      dun = khonogDun * khonog + dun1;
    }
  }

  return dun;
};

// ──────────────────────────────────────────────────────────────────────────
// Route (unchanged) — tip: allow client to pass test "garsanOgnoo" for reproducible checks
router.post("/tulburBodoy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const garsan = req.body.garsanOgnoo ? new Date(req.body.garsanOgnoo) : new Date();
    const orson = new Date(req.body.orsonOgnoo);

    const dun = await tulburBodoy(
      req.body.tulburuud,
      garsan.getTime(),
      orson.getTime(),
      1000,   // үндсэн үнэ
      true,   // 30 минутын блок
      0,      // дотор зогсоол
      undefined
    );
    res.json({ success: true, data: dun });
  } catch (err) {
    next(err);
  }
});

export default router;
