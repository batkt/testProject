import express, { Request, Response, NextFunction, Router } from "express";
import moment from 'moment';
const router: Router = express.Router();

const tulburBodoy = async (
  tulburuud: any,
  garakh: number,
  orson: number,
  undsenUne: number,
  undsenMin: boolean,
  dotorZogsoolMinut: number,
  zuruuMinut: any,
  zuvkhunMinutaar: boolean = false,
) => {
  let dun = 0;
  const diff = Math.abs(garakh - orson);
  let niitMinut = zuruuMinut ? zuruuMinut : Math.floor(diff / (1000 * 60));
  const seconds = async (t: any) => {
    const tt = moment(t).format('HH:mm');
    let [tsag, min] = tt.split(':').map(Number);
    return tsag * 3600 + min * 60;
  };
  const tariffTootsokh = async (v: any, min: number) => {
    let maxMin = v[v.length - 1]?.minut;
    let tariff = 0;
    for await (const z of v) {
      tariff = z.tulbur;
      if (min <= z.minut) break;
    }
    if (min > maxMin) {
      const time = undsenMin ? 30 : 60;
      let tsag = Math.ceil((min - maxMin) / time);
      tariff = tsag * undsenUne + tariff;
    }
    return tariff;
  };
  const tulburuudTootsokh = async (orsonSec: number, garsanSec: number, gantsXuwiartai: boolean = false) => {
    let tulbur = 0;
    for await (const x of tulburuud) {
      const zStartSec = await seconds(x.tsag[0]);
      const zEndSec = await seconds(x.tsag[1]);
      x.tariff.sort((a: any, b: any) => a.minut - b.minut);
      if (zEndSec < zStartSec) {
        const isInOvernight =
          (orsonSec >= zStartSec && orsonSec <= 86400) ||
          (orsonSec >= 0 && orsonSec <= zEndSec) ||
          (garsanSec >= zStartSec && garsanSec <= 86400) ||
          (garsanSec >= 0 && garsanSec <= zEndSec) ||
          (orsonSec <= zStartSec && garsanSec >= zEndSec);

        if (isInOvernight) {
          let overlapStart = orsonSec;
          if (orsonSec < zStartSec) overlapStart = zStartSec;
          if (garsanSec <= zEndSec) {
            const bsanMin = (garsanSec + (86400 - overlapStart)) / 60;
            const tariff = await tariffTootsokh(x.tariff, bsanMin);
            if (tariff > 0) tulbur += tariff;
          } else {
            const bsanMin = (86400 - overlapStart) / 60;
            const tariff = await tariffTootsokh(x.tariff, bsanMin);
            if (tariff > 0) tulbur += tariff;
          }
        }
      } else {
        if (zStartSec <= orsonSec && zEndSec >= orsonSec && zEndSec >= garsanSec) {
          var bsanMin: number = 0;
          if (!!gantsXuwiartai) bsanMin = zuruuMinut ? zuruuMinut : (zEndSec - orsonSec + (garsanSec - zStartSec)) / 60;
          else bsanMin = zuruuMinut ? zuruuMinut : (garsanSec - orsonSec) / 60;
          const tariff = await tariffTootsokh(x.tariff, bsanMin);
          if (tariff > 0) tulbur = tariff;
          break;
        } else if (zStartSec <= orsonSec && zEndSec >= orsonSec && zEndSec <= garsanSec) {
          const bsanMin = Math.trunc(zuruuMinut ? zuruuMinut : (zEndSec - orsonSec) / 60);
          const tariff = await tariffTootsokh(x.tariff, bsanMin);
          if (tariff > 0) tulbur = tulbur + tariff;
        } else if (orsonSec < zStartSec && zStartSec < garsanSec && zEndSec >= garsanSec) {
          const bsanMin = zuruuMinut ? zuruuMinut : (garsanSec - zStartSec) / 60;
          const tariff = await tariffTootsokh(x.tariff, bsanMin);
          if (tariff > 0) tulbur = tulbur + tariff;
        } else if (orsonSec < zStartSec && zEndSec < garsanSec) {
          const bsanMin = zuruuMinut ? zuruuMinut : (zEndSec - zStartSec) / 60;
          const tariff = await tariffTootsokh(x.tariff, bsanMin);
          if (tariff > 0) tulbur = tulbur + tariff;
        }
      }
    }
    return tulbur;
  };
  let orsonSec = await seconds(orson);
  let garsanSec = await seconds(garakh);
  var gantsXuwiartai = false;
  if (tulburuud.length == 1) gantsXuwiartai = true;
  if (dotorZogsoolMinut > 0) {
    const niitSec = (niitMinut - dotorZogsoolMinut) * 60;
    niitMinut = niitMinut - dotorZogsoolMinut;
    if (niitMinut < 1440 && niitSec < garsanSec) {
      orsonSec = garsanSec - niitSec;
    }
  }
  if (orsonSec > garsanSec) {
    let dun1 = 0;
    let dun2 = 0;
    if (dotorZogsoolMinut > 0) {
      if (niitMinut < 1440) {
        const niitSec = niitMinut * 60;
        dun1 = await tulburuudTootsokh(86400 - niitSec, 86400);
      } else {
        const zurvv = (niitMinut % 1440) * 60;
        dun1 = await tulburuudTootsokh(86400 - zurvv, 86400);
      }
    } else {
      if (!!gantsXuwiartai) {
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

router.post("/tulburBodoy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const garsan = new Date(); // одоо цаг
    const orson = new Date("2025-10-29T23:59:45.412"); // орсон цаг

    const dun = await tulburBodoy(
      req.body.tulburuud,    // төлбөрийн бүтэц
      garsan.getTime(),
      orson.getTime(),
      1000,                  // үндсэн үнэ
      true,                  // үндсэн мин ашиглах эсэх
      0,                     // дотор зогсоол минут
      undefined              // зөрүү минут (алгассан)
    );

    res.json({ success: true, data: dun });
  } catch (err) {
    next(err); // алдааг middleware руу дамжуулна
  }
});

export default router;
