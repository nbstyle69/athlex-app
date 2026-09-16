// GÉNÉRÉ par packages/wod-engine/scripts/bundle-edge.mjs — ne pas éditer.

// packages/wod-engine/src/types.ts
var FUNCTIONAL_CATEGORIES = ["scaled", "inter", "rx", "rxplus", "elite", "pro"];
var HYBRID_CATEGORIES = ["women", "men", "women_pro", "men_pro"];
var NoValidWod = class extends Error {
  reasons;
  constructor(message, reasons) {
    super(message);
    this.name = "NoValidWod";
    this.reasons = reasons;
  }
};

// packages/wod-engine/src/rng.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var RNG = class {
  r;
  constructor(seed) {
    this.r = mulberry32(seed);
  }
  float() {
    return this.r();
  }
  int(min, max) {
    return Math.floor(this.r() * (max - min + 1)) + min;
  }
  pick(arr) {
    return arr[Math.floor(this.r() * arr.length)];
  }
  /** tirage pondéré ; poids ≤ 0 jamais tirés */
  pickWeighted(arr, weight) {
    let total2 = 0;
    for (const x of arr) total2 += Math.max(0, weight(x));
    if (total2 <= 0) return void 0;
    let cursor = this.r() * total2;
    for (const x of arr) {
      const w = Math.max(0, weight(x));
      if (w <= 0) continue;
      cursor -= w;
      if (cursor < 0) return x;
    }
    return arr[arr.length - 1];
  }
  sample(arr, n) {
    return this.shuffle([...arr]).slice(0, n);
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
};

// packages/wod-engine/src/catalog.ts
function json(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") return JSON.parse(v);
  return v;
}
function muscuFromRow(r) {
  if (!r.discipline_muscu || !r.muscle_primary) return null;
  return {
    muscle_primary: r.muscle_primary,
    muscle_secondary: r.muscle_secondary ?? [],
    compound: !!r.compound,
    unilateral: !!r.unilateral,
    level_min: r.level_min ?? "debutant",
    load_mode: r.load_mode ?? "rpe",
    rm_reference: r.rm_reference ?? null,
    rm_factor: r.rm_factor == null ? null : Number(r.rm_factor),
    seconds_per_rep: Number(r.seconds_per_rep ?? 3),
    setup_s: Number(r.setup_s ?? 0),
    objectives: r.objectives ?? [],
    rep_ranges: json(r.rep_ranges_muscu) ?? {},
    weight_bodyweight: Number(r.weight_bodyweight ?? 0),
    weight_box: Number(r.weight_box ?? 0),
    weight_gym: Number(r.weight_gym ?? 0),
    unit: r.muscu_unit ?? "reps"
  };
}
function movementFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    family: r.family,
    pattern: r.pattern,
    modality: r.modality,
    grip: r.grip,
    shoulder_load: r.shoulder_load,
    unit_default: r.unit_default,
    units_allowed: r.units_allowed ?? [r.unit_default],
    load_unit: r.load_unit ?? null,
    weight_functional: r.weight_functional,
    weight_hybrid: r.weight_hybrid,
    equipment: r.equipment ?? [],
    cadence: json(r.cadence),
    loads: json(r.loads),
    rep_ranges: json(r.rep_ranges),
    substitutions: json(r.substitutions),
    variant_up: r.variant_up ?? null,
    badge_key: r.badge_key ?? null,
    active: r.active,
    version: r.version,
    notes: r.notes ?? null,
    muscu: muscuFromRow(r)
  };
}
function catalogFromRows(rows) {
  const movements = rows.map(movementFromRow);
  const version = movements.reduce((v, m) => Math.max(v, m.version), 0);
  return { version, movements };
}
function movementById(catalog, id) {
  return catalog.movements.find((m) => m.id === id);
}
function nameKey(raw) {
  return raw.toLowerCase().replace(/&/g, " and ").replace(/\([^)]*\)/g, "").replace(/[^\w\s]/g, " ").trim().split(/\s+/).map((w) => /[^s]s$/.test(w) ? w.slice(0, -1) : w).join(" ");
}
function resolveMovement(catalog, idOrName) {
  const byId = movementById(catalog, idOrName);
  if (byId) return byId;
  const key = nameKey(idOrName);
  return catalog.movements.find((m) => nameKey(m.name) === key);
}
function primaryPattern(m) {
  return m.pattern[0];
}
function isFunctionalCategory(c) {
  return FUNCTIONAL_CATEGORIES.includes(c);
}
function categoriesFor(discipline) {
  return discipline === "functional" ? FUNCTIONAL_CATEGORIES : HYBRID_CATEGORIES;
}
function functionalRef(c) {
  if (isFunctionalCategory(c)) return c;
  return c === "women_pro" || c === "men_pro" ? "rxplus" : "rx";
}
function genderIndex(c) {
  return c === "women" || c === "women_pro" ? 1 : 0;
}
function loadsFor(m, category, band) {
  if (!m.loads) return null;
  const ref = functionalRef(category);
  const byBand = m.loads[ref];
  if (!byBand) return null;
  const pair = byBand[band];
  if (!pair) return null;
  if (isFunctionalCategory(category)) return [pair[0], pair[1]];
  return [pair[genderIndex(category)]];
}
function cadenceFor(m, category, unit) {
  if (!m.cadence) return void 0;
  return m.cadence[functionalRef(category)]?.[unit];
}
function substitutionFor(m, category) {
  return m.substitutions?.[functionalRef(category)] ?? null;
}
function weightFor(m, discipline) {
  return discipline === "functional" ? m.weight_functional : m.weight_hybrid;
}

// packages/wod-engine/src/catalog/snapshot.ts
var CATALOG_SNAPSHOT = {
  "version": 2,
  "movements": [
    {
      "id": "thruster",
      "name": "Thruster",
      "family": "barbell",
      "pattern": [
        "squat",
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 9,
      "weight_hybrid": 2,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 4.16
        },
        "inter": {
          "reps": 3.68
        },
        "rx": {
          "reps": 3.2
        },
        "rxplus": {
          "reps": 2.94
        },
        "elite": {
          "reps": 2.72
        },
        "pro": {
          "reps": 2.56
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            70,
            50
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            80,
            55
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            90,
            60
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            9,
            15
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            8,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_thrusters",
      "active": true,
      "version": 2,
      "notes": "bench 21-15-9 = Fran",
      "muscu": null
    },
    {
      "id": "power_snatch",
      "name": "Power Snatch",
      "family": "barbell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 8,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 4.55
        },
        "inter": {
          "reps": 4.02
        },
        "rx": {
          "reps": 3.5
        },
        "rxplus": {
          "reps": 3.22
        },
        "elite": {
          "reps": 2.98
        },
        "pro": {
          "reps": 2.8
        }
      },
      "loads": {
        "scaled": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "inter": {
          "light": [
            25,
            20
          ],
          "medium": [
            35,
            25
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            43,
            30
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rxplus": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            40,
            30
          ],
          "medium": [
            55,
            40
          ],
          "heavy": [
            80,
            55
          ]
        },
        "pro": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            90,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            3,
            7
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_snatch",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "hang_power_snatch",
      "name": "Hang Power Snatch",
      "family": "barbell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "inter": {
          "light": [
            25,
            20
          ],
          "medium": [
            35,
            25
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            43,
            30
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rxplus": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            40,
            30
          ],
          "medium": [
            55,
            40
          ],
          "heavy": [
            80,
            55
          ]
        },
        "pro": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            90,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "squat_snatch",
      "name": "Squat Snatch",
      "family": "barbell",
      "pattern": [
        "hinge",
        "squat"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 6.5
        },
        "inter": {
          "reps": 5.75
        },
        "rx": {
          "reps": 5
        },
        "rxplus": {
          "reps": 4.6
        },
        "elite": {
          "reps": 4.25
        },
        "pro": {
          "reps": 4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "inter": {
          "light": [
            25,
            20
          ],
          "medium": [
            35,
            25
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            43,
            30
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rxplus": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            40,
            30
          ],
          "medium": [
            55,
            40
          ],
          "heavy": [
            80,
            55
          ]
        },
        "pro": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            90,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            8
          ],
          "for_time": [
            3,
            10
          ],
          "emom": [
            2,
            5
          ],
          "interval": [
            3,
            6
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_snatch",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "overhead_squat",
      "name": "Overhead Squat",
      "family": "barbell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "inter": {
          "light": [
            25,
            20
          ],
          "medium": [
            35,
            25
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            43,
            30
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rxplus": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            40,
            30
          ],
          "medium": [
            55,
            40
          ],
          "heavy": [
            80,
            55
          ]
        },
        "pro": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            90,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_ohs",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "power_clean",
      "name": "Power Clean",
      "family": "barbell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 9,
      "weight_hybrid": 1,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 4.55
        },
        "inter": {
          "reps": 4.02
        },
        "rx": {
          "reps": 3.5
        },
        "rxplus": {
          "reps": 3.22
        },
        "elite": {
          "reps": 2.98
        },
        "pro": {
          "reps": 2.8
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            60,
            40
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            80,
            55
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            120,
            80
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            140,
            95
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            160,
            110
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            3,
            7
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_clean",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "hang_power_clean",
      "name": "Hang Power Clean",
      "family": "barbell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 7,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            60,
            40
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            80,
            55
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            120,
            80
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            140,
            95
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            140,
            85
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_clean",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "squat_clean",
      "name": "Squat Clean",
      "family": "barbell",
      "pattern": [
        "hinge",
        "squat"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 6.5
        },
        "inter": {
          "reps": 5.75
        },
        "rx": {
          "reps": 5
        },
        "rxplus": {
          "reps": 4.6
        },
        "elite": {
          "reps": 4.25
        },
        "pro": {
          "reps": 4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            60,
            40
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            80,
            55
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            120,
            80
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            140,
            95
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            160,
            110
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            8
          ],
          "for_time": [
            3,
            10
          ],
          "emom": [
            2,
            5
          ],
          "interval": [
            3,
            6
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_clean",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "clean_and_jerk",
      "name": "Clean & Jerk",
      "family": "barbell",
      "pattern": [
        "hinge",
        "push_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 7,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 7.15
        },
        "inter": {
          "reps": 6.32
        },
        "rx": {
          "reps": 5.5
        },
        "rxplus": {
          "reps": 5.06
        },
        "elite": {
          "reps": 4.67
        },
        "pro": {
          "reps": 4.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            60,
            40
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            80,
            55
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            120,
            80
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            140,
            95
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            160,
            110
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            8
          ],
          "for_time": [
            3,
            10
          ],
          "emom": [
            2,
            5
          ],
          "interval": [
            3,
            6
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_cj",
      "active": true,
      "version": 2,
      "notes": "bench 30 for time = Grace",
      "muscu": null
    },
    {
      "id": "push_press",
      "name": "Push Press",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 7,
      "weight_hybrid": 1,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.25
        },
        "inter": {
          "reps": 2.88
        },
        "rx": {
          "reps": 2.5
        },
        "rxplus": {
          "reps": 2.3
        },
        "elite": {
          "reps": 2.12
        },
        "pro": {
          "reps": 2
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            70,
            50
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            80,
            55
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            90,
            60
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_press",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "push_jerk",
      "name": "Push Jerk",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.64
        },
        "inter": {
          "reps": 3.22
        },
        "rx": {
          "reps": 2.8
        },
        "rxplus": {
          "reps": 2.58
        },
        "elite": {
          "reps": 2.38
        },
        "pro": {
          "reps": 2.24
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            70,
            50
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            80,
            55
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            90,
            60
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_press",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "shoulder_to_overhead",
      "name": "Shoulder To Overhead",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 8,
      "weight_hybrid": 1,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.64
        },
        "inter": {
          "reps": 3.22
        },
        "rx": {
          "reps": 2.8
        },
        "rxplus": {
          "reps": 2.58
        },
        "elite": {
          "reps": 2.38
        },
        "pro": {
          "reps": 2.24
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            70,
            50
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            80,
            55
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            90,
            60
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_press",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "front_squat",
      "name": "Front Squat",
      "family": "barbell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 7,
      "weight_hybrid": 1,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            40,
            30
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            40
          ]
        },
        "inter": {
          "light": [
            50,
            35
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            80,
            55
          ]
        },
        "rx": {
          "light": [
            60,
            43
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rxplus": {
          "light": [
            70,
            50
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            120,
            80
          ]
        },
        "elite": {
          "light": [
            80,
            55
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            140,
            95
          ]
        },
        "pro": {
          "light": [
            90,
            60
          ],
          "medium": [
            100,
            70
          ],
          "heavy": [
            160,
            110
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_squat",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "tronc",
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "back_squat",
        "rm_factor": 0.85,
        "seconds_per_rep": 4,
        "setup_s": 60,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "back_squat",
      "name": "Back Squat",
      "family": "barbell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 1,
      "equipment": [
        "barbell",
        "rack"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            40,
            30
          ],
          "medium": [
            60,
            40
          ],
          "heavy": [
            80,
            55
          ]
        },
        "inter": {
          "light": [
            50,
            35
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rx": {
          "light": [
            60,
            43
          ],
          "medium": [
            100,
            70
          ],
          "heavy": [
            140,
            95
          ]
        },
        "rxplus": {
          "light": [
            70,
            50
          ],
          "medium": [
            120,
            80
          ],
          "heavy": [
            160,
            110
          ]
        },
        "elite": {
          "light": [
            80,
            55
          ],
          "medium": [
            140,
            95
          ],
          "heavy": [
            180,
            120
          ]
        },
        "pro": {
          "light": [
            90,
            60
          ],
          "medium": [
            160,
            110
          ],
          "heavy": [
            200,
            140
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            5,
            10
          ],
          "for_time": [
            5,
            15
          ],
          "emom": [
            3,
            6
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_squat",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers",
          "tronc"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "back_squat",
        "rm_factor": 1,
        "seconds_per_rep": 4,
        "setup_s": 60,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "deadlift",
      "name": "Deadlift",
      "family": "barbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 9,
      "weight_hybrid": 2,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.25
        },
        "inter": {
          "reps": 2.88
        },
        "rx": {
          "reps": 2.5
        },
        "rxplus": {
          "reps": 2.3
        },
        "elite": {
          "reps": 2.12
        },
        "pro": {
          "reps": 2
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            35
          ],
          "medium": [
            60,
            40
          ],
          "heavy": [
            80,
            55
          ]
        },
        "inter": {
          "light": [
            60,
            43
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rx": {
          "light": [
            70,
            50
          ],
          "medium": [
            100,
            70
          ],
          "heavy": [
            140,
            95
          ]
        },
        "rxplus": {
          "light": [
            80,
            55
          ],
          "medium": [
            120,
            80
          ],
          "heavy": [
            160,
            110
          ]
        },
        "elite": {
          "light": [
            90,
            60
          ],
          "medium": [
            140,
            95
          ],
          "heavy": [
            180,
            120
          ]
        },
        "pro": {
          "light": [
            100,
            70
          ],
          "medium": [
            160,
            110
          ],
          "heavy": [
            200,
            140
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            21
          ],
          "emom": [
            3,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_deadlifts",
      "active": true,
      "version": 2,
      "notes": "bench 21-15-9 = Diane",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "ischios",
          "fessiers",
          "tronc"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 1,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "sumo_deadlift_high_pull",
      "name": "Sumo Deadlift High Pull",
      "family": "barbell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": {
        "scaled": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "inter": {
          "light": [
            25,
            20
          ],
          "medium": [
            35,
            25
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            43,
            30
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rxplus": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            40,
            30
          ],
          "medium": [
            55,
            40
          ],
          "heavy": [
            80,
            55
          ]
        },
        "pro": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            90,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_sdlhp",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "bench_press",
      "name": "Bench Press",
      "family": "barbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 4,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "bench"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.64
        },
        "inter": {
          "reps": 3.22
        },
        "rx": {
          "reps": 2.8
        },
        "rxplus": {
          "reps": 2.58
        },
        "elite": {
          "reps": 2.38
        },
        "pro": {
          "reps": 2.24
        }
      },
      "loads": {
        "scaled": {
          "light": [
            40,
            30
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            40
          ]
        },
        "inter": {
          "light": [
            50,
            35
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            80,
            55
          ]
        },
        "rx": {
          "light": [
            60,
            43
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rxplus": {
          "light": [
            70,
            50
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            120,
            80
          ]
        },
        "elite": {
          "light": [
            80,
            55
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            140,
            95
          ]
        },
        "pro": {
          "light": [
            90,
            60
          ],
          "medium": [
            100,
            70
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            5,
            10
          ],
          "for_time": [
            5,
            15
          ],
          "emom": [
            3,
            8
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_bench_press",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps",
          "epaules_ant"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "bench",
        "rm_factor": 1,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "front_rack_lunge",
      "name": "Front Rack Lunges",
      "family": "barbell",
      "pattern": [
        "lunge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 2,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.25
        },
        "inter": {
          "reps": 2.88
        },
        "rx": {
          "reps": 2.5
        },
        "rxplus": {
          "reps": 2.3
        },
        "elite": {
          "reps": 2.12
        },
        "pro": {
          "reps": 2
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            70,
            50
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            80,
            55
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            90,
            60
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "reps = pas au total",
      "muscu": null
    },
    {
      "id": "bar_facing_burpee",
      "name": "Bar Facing Burpees",
      "family": "bodyweight",
      "pattern": [
        "core",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 8,
      "weight_hybrid": 2,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.85
        },
        "inter": {
          "reps": 5.17
        },
        "rx": {
          "reps": 4.5
        },
        "rxplus": {
          "reps": 4.14
        },
        "elite": {
          "reps": 3.82
        },
        "pro": {
          "reps": 3.6
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_burpee",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "kb_swing_american",
      "name": "KB Swing",
      "family": "kettlebell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 8,
      "weight_hybrid": 4,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.6
        },
        "inter": {
          "reps": 2.3
        },
        "rx": {
          "reps": 2
        },
        "rxplus": {
          "reps": 1.84
        },
        "elite": {
          "reps": 1.7
        },
        "pro": {
          "reps": 1.6
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            15,
            30
          ],
          "emom": [
            8,
            15
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_kb_swing",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "kb_swing_russian",
      "name": "KB Swings Russian",
      "family": "kettlebell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 5,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.34
        },
        "inter": {
          "reps": 2.07
        },
        "rx": {
          "reps": 1.8
        },
        "rxplus": {
          "reps": 1.66
        },
        "elite": {
          "reps": 1.53
        },
        "pro": {
          "reps": 1.44
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            15,
            30
          ],
          "emom": [
            8,
            15
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "kb_goblet_squat",
      "name": "Goblet Squat",
      "family": "kettlebell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 4,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.25
        },
        "inter": {
          "reps": 2.88
        },
        "rx": {
          "reps": 2.5
        },
        "rxplus": {
          "reps": 2.3
        },
        "elite": {
          "reps": 2.12
        },
        "pro": {
          "reps": 2
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            25
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            15
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_goblet_squat",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "db_snatch",
      "name": "Alt DB Snatch",
      "family": "dumbbell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 8,
      "weight_hybrid": 3,
      "equipment": [
        "dumbbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": {
        "scaled": {
          "light": [
            10,
            7.5
          ],
          "medium": [
            15,
            10
          ],
          "heavy": [
            20,
            12.5
          ]
        },
        "inter": {
          "light": [
            12.5,
            10
          ],
          "medium": [
            20,
            12.5
          ],
          "heavy": [
            22.5,
            15
          ]
        },
        "rx": {
          "light": [
            15,
            10
          ],
          "medium": [
            22.5,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "rxplus": {
          "light": [
            20,
            12.5
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            35,
            22.5
          ]
        },
        "elite": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            35,
            22.5
          ],
          "heavy": [
            40,
            25
          ]
        },
        "pro": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            40,
            25
          ],
          "heavy": [
            50,
            30
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "altern\xE9, reps au total",
      "muscu": null
    },
    {
      "id": "db_thruster",
      "name": "DB Thruster",
      "family": "dumbbell",
      "pattern": [
        "squat",
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 7,
      "weight_hybrid": 3,
      "equipment": [
        "dumbbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            10,
            7.5
          ],
          "medium": [
            15,
            10
          ],
          "heavy": [
            20,
            12.5
          ]
        },
        "inter": {
          "light": [
            12.5,
            10
          ],
          "medium": [
            20,
            12.5
          ],
          "heavy": [
            22.5,
            15
          ]
        },
        "rx": {
          "light": [
            15,
            10
          ],
          "medium": [
            22.5,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "rxplus": {
          "light": [
            20,
            12.5
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            35,
            22.5
          ]
        },
        "elite": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            35,
            22.5
          ],
          "heavy": [
            40,
            25
          ]
        },
        "pro": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            40,
            25
          ],
          "heavy": [
            50,
            30
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_db_thruster",
      "active": true,
      "version": 2,
      "notes": "2 DB",
      "muscu": null
    },
    {
      "id": "db_clean_and_jerk",
      "name": "DB Clean & Jerk",
      "family": "dumbbell",
      "pattern": [
        "hinge",
        "push_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 3,
      "equipment": [
        "dumbbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 4.55
        },
        "inter": {
          "reps": 4.02
        },
        "rx": {
          "reps": 3.5
        },
        "rxplus": {
          "reps": 3.22
        },
        "elite": {
          "reps": 2.98
        },
        "pro": {
          "reps": 2.8
        }
      },
      "loads": {
        "scaled": {
          "light": [
            10,
            7.5
          ],
          "medium": [
            15,
            10
          ],
          "heavy": [
            20,
            12.5
          ]
        },
        "inter": {
          "light": [
            12.5,
            10
          ],
          "medium": [
            20,
            12.5
          ],
          "heavy": [
            22.5,
            15
          ]
        },
        "rx": {
          "light": [
            15,
            10
          ],
          "medium": [
            22.5,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "rxplus": {
          "light": [
            20,
            12.5
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            35,
            22.5
          ]
        },
        "elite": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            35,
            22.5
          ],
          "heavy": [
            40,
            25
          ]
        },
        "pro": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            40,
            25
          ],
          "heavy": [
            50,
            30
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_db_cj",
      "active": true,
      "version": 2,
      "notes": "2 DB",
      "muscu": null
    },
    {
      "id": "db_box_step_over",
      "name": "DB Box Step Over",
      "family": "dumbbell",
      "pattern": [
        "lunge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 6,
      "equipment": [
        "dumbbell",
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.2
        },
        "inter": {
          "reps": 4.6
        },
        "rx": {
          "reps": 4
        },
        "rxplus": {
          "reps": 3.68
        },
        "elite": {
          "reps": 3.4
        },
        "pro": {
          "reps": 3.2
        }
      },
      "loads": {
        "scaled": {
          "light": [
            10,
            7.5
          ],
          "medium": [
            15,
            10
          ],
          "heavy": [
            20,
            12.5
          ]
        },
        "inter": {
          "light": [
            12.5,
            10
          ],
          "medium": [
            20,
            12.5
          ],
          "heavy": [
            22.5,
            15
          ]
        },
        "rx": {
          "light": [
            15,
            10
          ],
          "medium": [
            22.5,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "rxplus": {
          "light": [
            20,
            12.5
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            35,
            22.5
          ]
        },
        "elite": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            35,
            22.5
          ],
          "heavy": [
            40,
            25
          ]
        },
        "pro": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            40,
            25
          ],
          "heavy": [
            50,
            30
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            8,
            15
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "db_lunge",
      "name": "DB Lunges",
      "family": "dumbbell",
      "pattern": [
        "lunge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 7,
      "equipment": [
        "dumbbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": {
        "scaled": {
          "light": [
            10,
            7.5
          ],
          "medium": [
            15,
            10
          ],
          "heavy": [
            20,
            12.5
          ]
        },
        "inter": {
          "light": [
            12.5,
            10
          ],
          "medium": [
            20,
            12.5
          ],
          "heavy": [
            22.5,
            15
          ]
        },
        "rx": {
          "light": [
            15,
            10
          ],
          "medium": [
            22.5,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "rxplus": {
          "light": [
            20,
            12.5
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            35,
            22.5
          ]
        },
        "elite": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            35,
            22.5
          ],
          "heavy": [
            40,
            25
          ]
        },
        "pro": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            40,
            25
          ],
          "heavy": [
            50,
            30
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_lunge",
      "active": true,
      "version": 2,
      "notes": "reps = pas au total",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "devil_press",
      "name": "Devils Press",
      "family": "dumbbell",
      "pattern": [
        "hinge",
        "push_v",
        "core"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 4,
      "equipment": [
        "dumbbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 7.8
        },
        "inter": {
          "reps": 6.9
        },
        "rx": {
          "reps": 6
        },
        "rxplus": {
          "reps": 5.52
        },
        "elite": {
          "reps": 5.1
        },
        "pro": {
          "reps": 4.8
        }
      },
      "loads": {
        "scaled": {
          "light": [
            10,
            7.5
          ],
          "medium": [
            15,
            10
          ],
          "heavy": [
            20,
            12.5
          ]
        },
        "inter": {
          "light": [
            12.5,
            10
          ],
          "medium": [
            20,
            12.5
          ],
          "heavy": [
            22.5,
            15
          ]
        },
        "rx": {
          "light": [
            15,
            10
          ],
          "medium": [
            22.5,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "rxplus": {
          "light": [
            20,
            12.5
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            35,
            22.5
          ]
        },
        "elite": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            35,
            22.5
          ],
          "heavy": [
            40,
            25
          ]
        },
        "pro": {
          "light": [
            22.5,
            15
          ],
          "medium": [
            40,
            25
          ],
          "heavy": [
            50,
            30
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            5,
            10
          ],
          "for_time": [
            6,
            12
          ],
          "emom": [
            3,
            6
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_devil_press",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "db_farmer_carry",
      "name": "Farmer Carry",
      "family": "carry",
      "pattern": [
        "carry"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": "kg",
      "weight_functional": 4,
      "weight_hybrid": 9,
      "equipment": [
        "kettlebell",
        "dumbbell"
      ],
      "cadence": {
        "scaled": {
          "m": 1.1
        },
        "inter": {
          "m": 0.98
        },
        "rx": {
          "m": 0.85
        },
        "rxplus": {
          "m": 0.78
        },
        "elite": {
          "m": 0.72
        },
        "pro": {
          "m": 0.68
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "m": {
          "amrap": [
            50,
            200
          ],
          "for_time": [
            50,
            200
          ],
          "emom": [
            40,
            60
          ],
          "interval": [
            50,
            100
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "charge par main",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "avant_bras",
          "trapezes"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 20,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "m"
      }
    },
    {
      "id": "wall_ball",
      "name": "Wall Balls",
      "family": "wallball",
      "pattern": [
        "squat",
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 9,
      "weight_hybrid": 8,
      "equipment": [
        "wallball"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.25
        },
        "inter": {
          "reps": 2.88
        },
        "rx": {
          "reps": 2.5
        },
        "rxplus": {
          "reps": 2.3
        },
        "elite": {
          "reps": 2.12
        },
        "pro": {
          "reps": 2
        }
      },
      "loads": {
        "scaled": {
          "light": [
            4,
            3
          ],
          "medium": [
            6,
            4
          ],
          "heavy": [
            9,
            6
          ]
        },
        "inter": {
          "light": [
            6,
            4
          ],
          "medium": [
            9,
            6
          ],
          "heavy": [
            9,
            6
          ]
        },
        "rx": {
          "light": [
            6,
            4
          ],
          "medium": [
            9,
            6
          ],
          "heavy": [
            14,
            9
          ]
        },
        "rxplus": {
          "light": [
            9,
            6
          ],
          "medium": [
            12,
            9
          ],
          "heavy": [
            14,
            9
          ]
        },
        "elite": {
          "light": [
            9,
            6
          ],
          "medium": [
            14,
            9
          ],
          "heavy": [
            20,
            14
          ]
        },
        "pro": {
          "light": [
            9,
            6
          ],
          "medium": [
            14,
            9
          ],
          "heavy": [
            20,
            14
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            15,
            50
          ],
          "emom": [
            8,
            15
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_wallball",
      "active": true,
      "version": 2,
      "notes": "cible 3.05 m H / 2.75 m F ; Hyrox 100 reps race",
      "muscu": null
    },
    {
      "id": "sandbag_lunge",
      "name": "Sandbag Lunges",
      "family": "sandbag",
      "pattern": [
        "lunge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": "kg",
      "weight_functional": 3,
      "weight_hybrid": 9,
      "equipment": [
        "sandbag"
      ],
      "cadence": {
        "scaled": {
          "m": 2.6
        },
        "inter": {
          "m": 2.3
        },
        "rx": {
          "m": 2
        },
        "rxplus": {
          "m": 1.84
        },
        "elite": {
          "m": 1.7
        },
        "pro": {
          "m": 1.6
        }
      },
      "loads": {
        "scaled": {
          "light": [
            15,
            10
          ],
          "medium": [
            20,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "inter": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rxplus": {
          "light": [
            40,
            30
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            50,
            35
          ],
          "medium": [
            60,
            45
          ],
          "heavy": [
            80,
            60
          ]
        },
        "pro": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "m": {
          "amrap": [
            20,
            50
          ],
          "for_time": [
            25,
            100
          ],
          "emom": [
            15,
            25
          ],
          "interval": [
            20,
            40
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "Hyrox 100 m race",
      "muscu": null
    },
    {
      "id": "sandbag_carry",
      "name": "Sandbag Carry",
      "family": "carry",
      "pattern": [
        "carry"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": "kg",
      "weight_functional": 3,
      "weight_hybrid": 8,
      "equipment": [
        "sandbag"
      ],
      "cadence": {
        "scaled": {
          "m": 0.91
        },
        "inter": {
          "m": 0.8
        },
        "rx": {
          "m": 0.7
        },
        "rxplus": {
          "m": 0.64
        },
        "elite": {
          "m": 0.59
        },
        "pro": {
          "m": 0.56
        }
      },
      "loads": {
        "scaled": {
          "light": [
            15,
            10
          ],
          "medium": [
            20,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "inter": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rxplus": {
          "light": [
            40,
            30
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            50,
            35
          ],
          "medium": [
            60,
            45
          ],
          "heavy": [
            80,
            60
          ]
        },
        "pro": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "m": {
          "amrap": [
            50,
            200
          ],
          "for_time": [
            50,
            200
          ],
          "emom": [
            40,
            60
          ],
          "interval": [
            50,
            100
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "sandbag_clean",
      "name": "Sandbag Cleans",
      "family": "sandbag",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 4,
      "weight_hybrid": 6,
      "equipment": [
        "sandbag"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.2
        },
        "inter": {
          "reps": 4.6
        },
        "rx": {
          "reps": 4
        },
        "rxplus": {
          "reps": 3.68
        },
        "elite": {
          "reps": 3.4
        },
        "pro": {
          "reps": 3.2
        }
      },
      "loads": {
        "scaled": {
          "light": [
            15,
            10
          ],
          "medium": [
            20,
            15
          ],
          "heavy": [
            30,
            20
          ]
        },
        "inter": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            40,
            30
          ]
        },
        "rx": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rxplus": {
          "light": [
            40,
            30
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            50,
            35
          ],
          "medium": [
            60,
            45
          ],
          "heavy": [
            80,
            60
          ]
        },
        "pro": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            5,
            12
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            3,
            6
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "sandbag_over_shoulder",
      "name": "Sandbag Over Shoulder",
      "family": "sandbag",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 3,
      "weight_hybrid": 5,
      "equipment": [
        "sandbag"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.85
        },
        "inter": {
          "reps": 5.17
        },
        "rx": {
          "reps": 4.5
        },
        "rxplus": {
          "reps": 4.14
        },
        "elite": {
          "reps": 3.82
        },
        "pro": {
          "reps": 3.6
        }
      },
      "loads": {
        "scaled": {
          "light": [
            20,
            15
          ],
          "medium": [
            30,
            20
          ],
          "heavy": [
            30,
            20
          ]
        },
        "inter": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            40,
            30
          ]
        },
        "rx": {
          "light": [
            40,
            30
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            50,
            35
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            70,
            50
          ]
        },
        "elite": {
          "light": [
            60,
            45
          ],
          "medium": [
            80,
            60
          ],
          "heavy": [
            80,
            60
          ]
        },
        "pro": {
          "light": [
            70,
            50
          ],
          "medium": [
            100,
            70
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            5,
            10
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            3,
            6
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "sled_push",
      "name": "Sled Push",
      "family": "sled",
      "pattern": [
        "squat",
        "push_h"
      ],
      "modality": "W",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": "kg",
      "weight_functional": 4,
      "weight_hybrid": 10,
      "equipment": [
        "sled"
      ],
      "cadence": {
        "scaled": {
          "m": 2.86
        },
        "inter": {
          "m": 2.53
        },
        "rx": {
          "m": 2.2
        },
        "rxplus": {
          "m": 2.02
        },
        "elite": {
          "m": 1.87
        },
        "pro": {
          "m": 1.76
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            35
          ],
          "medium": [
            75,
            50
          ],
          "heavy": [
            100,
            75
          ]
        },
        "inter": {
          "light": [
            75,
            50
          ],
          "medium": [
            100,
            75
          ],
          "heavy": [
            125,
            100
          ]
        },
        "rx": {
          "light": [
            100,
            75
          ],
          "medium": [
            125,
            100
          ],
          "heavy": [
            150,
            125
          ]
        },
        "rxplus": {
          "light": [
            125,
            100
          ],
          "medium": [
            150,
            125
          ],
          "heavy": [
            175,
            150
          ]
        },
        "elite": {
          "light": [
            150,
            125
          ],
          "medium": [
            175,
            150
          ],
          "heavy": [
            200,
            175
          ]
        },
        "pro": {
          "light": [
            150,
            125
          ],
          "medium": [
            200,
            150
          ],
          "heavy": [
            250,
            200
          ]
        }
      },
      "rep_ranges": {
        "m": {
          "amrap": [
            20,
            50
          ],
          "for_time": [
            25,
            100
          ],
          "emom": [
            15,
            25
          ],
          "interval": [
            20,
            40
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "charge sled incluse ; Hyrox 50 m race",
      "muscu": null
    },
    {
      "id": "sled_pull",
      "name": "Sled Pull",
      "family": "sled",
      "pattern": [
        "pull_h",
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": "kg",
      "weight_functional": 3,
      "weight_hybrid": 10,
      "equipment": [
        "sled",
        "rope"
      ],
      "cadence": {
        "scaled": {
          "m": 3.38
        },
        "inter": {
          "m": 2.99
        },
        "rx": {
          "m": 2.6
        },
        "rxplus": {
          "m": 2.39
        },
        "elite": {
          "m": 2.21
        },
        "pro": {
          "m": 2.08
        }
      },
      "loads": {
        "scaled": {
          "light": [
            40,
            30
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            75,
            50
          ]
        },
        "inter": {
          "light": [
            50,
            40
          ],
          "medium": [
            75,
            50
          ],
          "heavy": [
            100,
            75
          ]
        },
        "rx": {
          "light": [
            75,
            50
          ],
          "medium": [
            100,
            75
          ],
          "heavy": [
            125,
            100
          ]
        },
        "rxplus": {
          "light": [
            100,
            75
          ],
          "medium": [
            125,
            100
          ],
          "heavy": [
            150,
            125
          ]
        },
        "elite": {
          "light": [
            100,
            75
          ],
          "medium": [
            150,
            125
          ],
          "heavy": [
            175,
            150
          ]
        },
        "pro": {
          "light": [
            125,
            100
          ],
          "medium": [
            150,
            125
          ],
          "heavy": [
            200,
            150
          ]
        }
      },
      "rep_ranges": {
        "m": {
          "amrap": [
            20,
            50
          ],
          "for_time": [
            25,
            100
          ],
          "emom": [
            15,
            25
          ],
          "interval": [
            20,
            40
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "Hyrox 50 m race",
      "muscu": null
    },
    {
      "id": "row",
      "name": "Row",
      "family": "erg",
      "pattern": [
        "mono",
        "pull_h"
      ],
      "modality": "M",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "cal",
      "units_allowed": [
        "cal",
        "m"
      ],
      "load_unit": null,
      "weight_functional": 9,
      "weight_hybrid": 9,
      "equipment": [
        "rower"
      ],
      "cadence": {
        "scaled": {
          "cal": 4.68,
          "m": 0.26
        },
        "inter": {
          "cal": 4.14,
          "m": 0.23
        },
        "rx": {
          "cal": 3.6,
          "m": 0.2
        },
        "rxplus": {
          "cal": 3.31,
          "m": 0.184
        },
        "elite": {
          "cal": 3.06,
          "m": 0.17
        },
        "pro": {
          "cal": 2.88,
          "m": 0.16
        }
      },
      "loads": null,
      "rep_ranges": {
        "cal": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            12,
            50
          ],
          "emom": [
            8,
            15
          ],
          "interval": [
            10,
            20
          ]
        },
        "m": {
          "amrap": [
            200,
            500
          ],
          "for_time": [
            250,
            1e3
          ],
          "emom": [
            150,
            250
          ],
          "interval": [
            200,
            500
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_row",
      "active": true,
      "version": 2,
      "notes": "cal ; 1 cal \u2248 18 m ; Hyrox 1000 m race",
      "muscu": null
    },
    {
      "id": "bike_erg",
      "name": "Bike Erg",
      "family": "erg",
      "pattern": [
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "cal",
      "units_allowed": [
        "cal",
        "m"
      ],
      "load_unit": null,
      "weight_functional": 8,
      "weight_hybrid": 7,
      "equipment": [
        "bike_erg"
      ],
      "cadence": {
        "scaled": {
          "cal": 4.29,
          "m": 0.117
        },
        "inter": {
          "cal": 3.79,
          "m": 0.103
        },
        "rx": {
          "cal": 3.3,
          "m": 0.09
        },
        "rxplus": {
          "cal": 3.04,
          "m": 0.083
        },
        "elite": {
          "cal": 2.8,
          "m": 0.076
        },
        "pro": {
          "cal": 2.64,
          "m": 0.072
        }
      },
      "loads": null,
      "rep_ranges": {
        "cal": {
          "amrap": [
            12,
            30
          ],
          "for_time": [
            15,
            60
          ],
          "emom": [
            10,
            18
          ],
          "interval": [
            12,
            25
          ]
        },
        "m": {
          "amrap": [
            500,
            1500
          ],
          "for_time": [
            500,
            2e3
          ],
          "emom": [
            300,
            600
          ],
          "interval": [
            500,
            1e3
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_bike",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "echo_bike",
      "name": "Echo Bike",
      "family": "erg",
      "pattern": [
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "cal",
      "units_allowed": [
        "cal"
      ],
      "load_unit": null,
      "weight_functional": 8,
      "weight_hybrid": 6,
      "equipment": [
        "echo_bike"
      ],
      "cadence": {
        "scaled": {
          "cal": 4.55
        },
        "inter": {
          "cal": 4.02
        },
        "rx": {
          "cal": 3.5
        },
        "rxplus": {
          "cal": 3.22
        },
        "elite": {
          "cal": 2.98
        },
        "pro": {
          "cal": 2.8
        }
      },
      "loads": null,
      "rep_ranges": {
        "cal": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            12,
            50
          ],
          "emom": [
            8,
            14
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_bike",
      "active": true,
      "version": 2,
      "notes": "cal F \u2248 0.8 \xD7 cal H, \xE0 g\xE9rer dans le rendu",
      "muscu": null
    },
    {
      "id": "ski_erg",
      "name": "SkiErg",
      "family": "erg",
      "pattern": [
        "mono",
        "pull_v",
        "core"
      ],
      "modality": "M",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "cal",
      "units_allowed": [
        "cal",
        "m"
      ],
      "load_unit": null,
      "weight_functional": 7,
      "weight_hybrid": 9,
      "equipment": [
        "ski_erg"
      ],
      "cadence": {
        "scaled": {
          "cal": 4.94,
          "m": 0.273
        },
        "inter": {
          "cal": 4.37,
          "m": 0.242
        },
        "rx": {
          "cal": 3.8,
          "m": 0.21
        },
        "rxplus": {
          "cal": 3.5,
          "m": 0.193
        },
        "elite": {
          "cal": 3.23,
          "m": 0.179
        },
        "pro": {
          "cal": 3.04,
          "m": 0.168
        }
      },
      "loads": null,
      "rep_ranges": {
        "cal": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            12,
            50
          ],
          "emom": [
            8,
            14
          ],
          "interval": [
            10,
            20
          ]
        },
        "m": {
          "amrap": [
            200,
            500
          ],
          "for_time": [
            250,
            1e3
          ],
          "emom": [
            150,
            250
          ],
          "interval": [
            200,
            500
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_ski",
      "active": true,
      "version": 2,
      "notes": "Hyrox 1000 m race",
      "muscu": null
    },
    {
      "id": "run",
      "name": "Run",
      "family": "run",
      "pattern": [
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": null,
      "weight_functional": 7,
      "weight_hybrid": 10,
      "equipment": [],
      "cadence": {
        "scaled": {
          "m": 0.35
        },
        "inter": {
          "m": 0.31
        },
        "rx": {
          "m": 0.27
        },
        "rxplus": {
          "m": 0.25
        },
        "elite": {
          "m": 0.23
        },
        "pro": {
          "m": 0.22
        }
      },
      "loads": null,
      "rep_ranges": {
        "m": {
          "amrap": [
            200,
            600
          ],
          "for_time": [
            200,
            1600
          ],
          "emom": [
            100,
            200
          ],
          "interval": [
            200,
            800
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_run",
      "active": true,
      "version": 2,
      "notes": "0.27 s/m = 4'30/km RX",
      "muscu": null
    },
    {
      "id": "shuttle_run",
      "name": "Shuttle Run",
      "family": "run",
      "pattern": [
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": null,
      "weight_functional": 6,
      "weight_hybrid": 8,
      "equipment": [],
      "cadence": {
        "scaled": {
          "m": 0.42
        },
        "inter": {
          "m": 0.37
        },
        "rx": {
          "m": 0.32
        },
        "rxplus": {
          "m": 0.29
        },
        "elite": {
          "m": 0.27
        },
        "pro": {
          "m": 0.26
        }
      },
      "loads": null,
      "rep_ranges": {
        "m": {
          "amrap": [
            50,
            200
          ],
          "for_time": [
            50,
            300
          ],
          "emom": [
            40,
            80
          ],
          "interval": [
            50,
            150
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "aller-retour 10 ou 25 m",
      "muscu": null
    },
    {
      "id": "pull_up",
      "name": "Pull-ups",
      "family": "gym",
      "pattern": [
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 8,
      "weight_hybrid": 3,
      "equipment": [
        "rig"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.34
        },
        "inter": {
          "reps": 2.07
        },
        "rx": {
          "reps": 1.8
        },
        "rxplus": {
          "reps": 1.66
        },
        "elite": {
          "reps": 1.53
        },
        "pro": {
          "reps": 1.44
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": {
        "scaled": "ring_row",
        "inter": "pull_up_banded"
      },
      "variant_up": "chest_to_bar",
      "badge_key": "mv_pullup",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "chest_to_bar",
      "name": "Chest-to-Bar",
      "family": "gym",
      "pattern": [
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 7,
      "weight_hybrid": 1,
      "equipment": [
        "rig"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": {
        "scaled": "ring_row",
        "inter": "pull_up"
      },
      "variant_up": "bar_muscle_up",
      "badge_key": "mv_c2b",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "toes_to_bar",
      "name": "Toes-to-Bar",
      "family": "gym",
      "pattern": [
        "core",
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 8,
      "weight_hybrid": 2,
      "equipment": [
        "rig"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.6
        },
        "inter": {
          "reps": 2.3
        },
        "rx": {
          "reps": 2
        },
        "rxplus": {
          "reps": 1.84
        },
        "elite": {
          "reps": 1.7
        },
        "pro": {
          "reps": 1.6
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": {
        "scaled": "hanging_knee_raise",
        "inter": "toes_to_bar"
      },
      "variant_up": null,
      "badge_key": "mv_t2b",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "bar_muscle_up",
      "name": "Bar Muscle-ups",
      "family": "gym",
      "pattern": [
        "pull_v",
        "push_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 4,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.2
        },
        "inter": {
          "reps": 4.6
        },
        "rx": {
          "reps": 4
        },
        "rxplus": {
          "reps": 3.68
        },
        "elite": {
          "reps": 3.4
        },
        "pro": {
          "reps": 3.2
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            8
          ],
          "for_time": [
            3,
            10
          ],
          "emom": [
            2,
            5
          ],
          "interval": [
            3,
            6
          ]
        }
      },
      "substitutions": {
        "scaled": "pull_up_banded",
        "inter": "chest_to_bar",
        "rx": "chest_to_bar"
      },
      "variant_up": null,
      "badge_key": "mv_bmu",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "ring_muscle_up",
      "name": "Ring Muscle-ups",
      "family": "gym",
      "pattern": [
        "pull_v",
        "push_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 3,
      "weight_hybrid": 0,
      "equipment": [
        "rings"
      ],
      "cadence": {
        "scaled": {
          "reps": 6.5
        },
        "inter": {
          "reps": 5.75
        },
        "rx": {
          "reps": 5
        },
        "rxplus": {
          "reps": 4.6
        },
        "elite": {
          "reps": 4.25
        },
        "pro": {
          "reps": 4
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            6
          ],
          "for_time": [
            3,
            9
          ],
          "emom": [
            2,
            4
          ],
          "interval": [
            3,
            5
          ]
        }
      },
      "substitutions": {
        "scaled": "ring_row",
        "inter": "chest_to_bar",
        "rx": "bar_muscle_up"
      },
      "variant_up": null,
      "badge_key": "mv_ring_mu",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "handstand_push_up",
      "name": "Handstand Push-ups",
      "family": "gym",
      "pattern": [
        "push_v"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 7,
      "weight_hybrid": 1,
      "equipment": [
        "wall"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": {
        "scaled": "push_up",
        "inter": "pike_push_up"
      },
      "variant_up": "strict_handstand_push_up",
      "badge_key": "mv_hspu",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "avance",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "strict_handstand_push_up",
      "name": "Strict Handstand Push-Ups",
      "family": "gym",
      "pattern": [
        "push_v"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 4,
      "weight_hybrid": 0,
      "equipment": [
        "wall"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.2
        },
        "inter": {
          "reps": 4.6
        },
        "rx": {
          "reps": 4
        },
        "rxplus": {
          "reps": 3.68
        },
        "elite": {
          "reps": 3.4
        },
        "pro": {
          "reps": 3.2
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            8
          ],
          "for_time": [
            5,
            12
          ],
          "emom": [
            2,
            5
          ],
          "interval": [
            3,
            6
          ]
        }
      },
      "substitutions": {
        "scaled": "push_up",
        "inter": "pike_push_up",
        "rx": "handstand_push_up"
      },
      "variant_up": null,
      "badge_key": "mv_hspu",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "wall_walk",
      "name": "Wall Walk",
      "family": "gym",
      "pattern": [
        "push_v",
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 5,
      "weight_hybrid": 1,
      "equipment": [
        "wall"
      ],
      "cadence": {
        "scaled": {
          "reps": 19.5
        },
        "inter": {
          "reps": 17.25
        },
        "rx": {
          "reps": 15
        },
        "rxplus": {
          "reps": 13.8
        },
        "elite": {
          "reps": 12.75
        },
        "pro": {
          "reps": 12
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            2,
            5
          ],
          "for_time": [
            3,
            8
          ],
          "emom": [
            1,
            3
          ],
          "interval": [
            2,
            4
          ]
        }
      },
      "substitutions": {
        "scaled": "inchworm",
        "inter": "half_wall_walk"
      },
      "variant_up": null,
      "badge_key": "mv_wallwalk",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "handstand_walk",
      "name": "Handstand Walk",
      "family": "gym",
      "pattern": [
        "push_v",
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": null,
      "weight_functional": 4,
      "weight_hybrid": 0,
      "equipment": [
        "floor"
      ],
      "cadence": {
        "scaled": {
          "m": 3.9
        },
        "inter": {
          "m": 3.45
        },
        "rx": {
          "m": 3
        },
        "rxplus": {
          "m": 2.76
        },
        "elite": {
          "m": 2.55
        },
        "pro": {
          "m": 2.4
        }
      },
      "loads": null,
      "rep_ranges": {
        "m": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            10,
            50
          ],
          "emom": [
            5,
            15
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": {
        "scaled": "bear_crawl",
        "inter": "handstand_shoulder_tap"
      },
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "ring_dip",
      "name": "Ring Dips",
      "family": "gym",
      "pattern": [
        "push_v"
      ],
      "modality": "G",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 5,
      "weight_hybrid": 0,
      "equipment": [
        "rings"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": {
        "scaled": "box_dip",
        "inter": "ring_dip_banded"
      },
      "variant_up": null,
      "badge_key": "mv_ring_dip",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "ring_row",
      "name": "Ring Rows",
      "family": "gym",
      "pattern": [
        "pull_h"
      ],
      "modality": "G",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 3,
      "weight_hybrid": 4,
      "equipment": [
        "rings"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.6
        },
        "inter": {
          "reps": 2.3
        },
        "rx": {
          "reps": 2
        },
        "rxplus": {
          "reps": 1.84
        },
        "elite": {
          "reps": 1.7
        },
        "pro": {
          "reps": 1.6
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            25
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            15
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_ring_row",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps",
          "trapezes"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "push_up",
      "name": "Push-ups",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 6,
      "weight_hybrid": 5,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 2.34
        },
        "inter": {
          "reps": 2.07
        },
        "rx": {
          "reps": 1.8
        },
        "rxplus": {
          "reps": 1.66
        },
        "elite": {
          "reps": 1.53
        },
        "pro": {
          "reps": 1.44
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": {
        "scaled": "knee_push_up"
      },
      "variant_up": null,
      "badge_key": "mv_pushup",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps",
          "tronc"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "pistol",
      "name": "Pistols",
      "family": "bodyweight",
      "pattern": [
        "squat"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 4,
      "weight_hybrid": 1,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            8,
            20
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": {
        "scaled": "box_pistol",
        "inter": "pistol_to_box"
      },
      "variant_up": null,
      "badge_key": "mv_pistol",
      "active": true,
      "version": 2,
      "notes": "altern\xE9, reps au total",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "avance",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 5,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "rope_climb",
      "name": "Rope Climbs",
      "family": "gym",
      "pattern": [
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 4,
      "weight_hybrid": 0,
      "equipment": [
        "rope"
      ],
      "cadence": {
        "scaled": {
          "reps": 19.5
        },
        "inter": {
          "reps": 17.25
        },
        "rx": {
          "reps": 15
        },
        "rxplus": {
          "reps": 13.8
        },
        "elite": {
          "reps": 12.75
        },
        "pro": {
          "reps": 12
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            1,
            4
          ],
          "for_time": [
            2,
            6
          ],
          "emom": [
            1,
            2
          ],
          "interval": [
            1,
            3
          ]
        }
      },
      "substitutions": {
        "scaled": "rope_pull_from_floor",
        "inter": "rope_climb"
      },
      "variant_up": "legless_rope_climb",
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "ghd_sit_up",
      "name": "GHD Sit-Ups",
      "family": "gym",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 5,
      "weight_hybrid": 2,
      "equipment": [
        "ghd"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            15
          ]
        }
      },
      "substitutions": {
        "scaled": "sit_up",
        "inter": "sit_up"
      },
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "sit_up",
      "name": "Sit-ups",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 5,
      "weight_hybrid": 5,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 2.08
        },
        "inter": {
          "reps": 1.84
        },
        "rx": {
          "reps": 1.6
        },
        "rxplus": {
          "reps": 1.47
        },
        "elite": {
          "reps": 1.36
        },
        "pro": {
          "reps": 1.28
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            15,
            30
          ],
          "for_time": [
            15,
            50
          ],
          "emom": [
            10,
            20
          ],
          "interval": [
            12,
            25
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_situp",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "hollow_rock",
      "name": "Hollow Rocks",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 4,
      "weight_hybrid": 5,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 1.56
        },
        "inter": {
          "reps": 1.38
        },
        "rx": {
          "reps": 1.2
        },
        "rxplus": {
          "reps": 1.1
        },
        "elite": {
          "reps": 1.02
        },
        "pro": {
          "reps": 0.96
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            15,
            30
          ],
          "for_time": [
            20,
            50
          ],
          "emom": [
            10,
            20
          ],
          "interval": [
            15,
            25
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_hollow",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "plank_hold",
      "name": "Plank Hold",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": null,
      "weight_functional": 3,
      "weight_hybrid": 5,
      "equipment": [],
      "cadence": {
        "scaled": {
          "s": 1.3
        },
        "inter": {
          "s": 1.15
        },
        "rx": {
          "s": 1
        },
        "rxplus": {
          "s": 0.92
        },
        "elite": {
          "s": 0.85
        },
        "pro": {
          "s": 0.8
        }
      },
      "loads": null,
      "rep_ranges": {
        "s": {
          "amrap": [
            30,
            60
          ],
          "for_time": [
            30,
            60
          ],
          "emom": [
            30,
            45
          ],
          "interval": [
            30,
            60
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "s"
      }
    },
    {
      "id": "burpee",
      "name": "Burpees",
      "family": "bodyweight",
      "pattern": [
        "core",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 9,
      "weight_hybrid": 7,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 5.2
        },
        "inter": {
          "reps": 4.6
        },
        "rx": {
          "reps": 4
        },
        "rxplus": {
          "reps": 3.68
        },
        "elite": {
          "reps": 3.4
        },
        "pro": {
          "reps": 3.2
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_burpee",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "burpee_box_jump_over",
      "name": "Burpee Box Jump Over",
      "family": "bodyweight",
      "pattern": [
        "core",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "cm",
      "weight_functional": 7,
      "weight_hybrid": 4,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 7.8
        },
        "inter": {
          "reps": 6.9
        },
        "rx": {
          "reps": 6
        },
        "rxplus": {
          "reps": 5.52
        },
        "elite": {
          "reps": 5.1
        },
        "pro": {
          "reps": 4.8
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            40
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            50,
            40
          ]
        },
        "inter": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rx": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rxplus": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "elite": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        },
        "pro": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            8,
            20
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_burpee_bj",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "burpee_broad_jump",
      "name": "Burpee Broad Jumps",
      "family": "bodyweight",
      "pattern": [
        "core",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": null,
      "weight_functional": 3,
      "weight_hybrid": 10,
      "equipment": [],
      "cadence": {
        "scaled": {
          "m": 3.38
        },
        "inter": {
          "m": 2.99
        },
        "rx": {
          "m": 2.6
        },
        "rxplus": {
          "m": 2.39
        },
        "elite": {
          "m": 2.21
        },
        "pro": {
          "m": 2.08
        }
      },
      "loads": null,
      "rep_ranges": {
        "m": {
          "amrap": [
            20,
            50
          ],
          "for_time": [
            20,
            80
          ],
          "emom": [
            10,
            20
          ],
          "interval": [
            15,
            30
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "Hyrox 80 m race",
      "muscu": null
    },
    {
      "id": "box_jump",
      "name": "Box Jumps",
      "family": "box",
      "pattern": [
        "squat",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "cm",
      "weight_functional": 8,
      "weight_hybrid": 4,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            40
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            50,
            40
          ]
        },
        "inter": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rx": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rxplus": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "elite": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        },
        "pro": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            15
          ]
        }
      },
      "substitutions": {
        "scaled": "box_step_up"
      },
      "variant_up": null,
      "badge_key": "mv_box_jump",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "box_jump_over",
      "name": "Box Jump-overs",
      "family": "box",
      "pattern": [
        "squat",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "cm",
      "weight_functional": 8,
      "weight_hybrid": 4,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            40
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            50,
            40
          ]
        },
        "inter": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rx": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rxplus": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "elite": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        },
        "pro": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": {
        "scaled": "box_step_over"
      },
      "variant_up": null,
      "badge_key": "mv_box_jump",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "box_step_up",
      "name": "Box Step-ups",
      "family": "box",
      "pattern": [
        "lunge"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "cm",
      "weight_functional": 4,
      "weight_hybrid": 7,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            40
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            50,
            40
          ]
        },
        "inter": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rx": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rxplus": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "elite": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        },
        "pro": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            40
          ],
          "emom": [
            8,
            15
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_box_jump",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "double_under",
      "name": "Double-unders",
      "family": "jump_rope",
      "pattern": [
        "mono"
      ],
      "modality": "M",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 9,
      "weight_hybrid": 3,
      "equipment": [
        "jump_rope"
      ],
      "cadence": {
        "scaled": {
          "reps": 0.72
        },
        "inter": {
          "reps": 0.63
        },
        "rx": {
          "reps": 0.55
        },
        "rxplus": {
          "reps": 0.51
        },
        "elite": {
          "reps": 0.47
        },
        "pro": {
          "reps": 0.44
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            30,
            60
          ],
          "for_time": [
            50,
            100
          ],
          "emom": [
            25,
            50
          ],
          "interval": [
            30,
            60
          ]
        }
      },
      "substitutions": {
        "scaled": "single_under",
        "inter": "double_under"
      },
      "variant_up": null,
      "badge_key": "mv_du",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "single_under",
      "name": "Single Unders",
      "family": "jump_rope",
      "pattern": [
        "mono"
      ],
      "modality": "M",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 3,
      "weight_hybrid": 2,
      "equipment": [
        "jump_rope"
      ],
      "cadence": {
        "scaled": {
          "reps": 0.45
        },
        "inter": {
          "reps": 0.4
        },
        "rx": {
          "reps": 0.35
        },
        "rxplus": {
          "reps": 0.32
        },
        "elite": {
          "reps": 0.3
        },
        "pro": {
          "reps": 0.28
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            60,
            120
          ],
          "for_time": [
            100,
            200
          ],
          "emom": [
            50,
            100
          ],
          "interval": [
            60,
            120
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_su",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "air_squat",
      "name": "Air Squats",
      "family": "bodyweight",
      "pattern": [
        "squat"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 7,
      "weight_hybrid": 4,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 1.82
        },
        "inter": {
          "reps": 1.61
        },
        "rx": {
          "reps": 1.4
        },
        "rxplus": {
          "reps": 1.29
        },
        "elite": {
          "reps": 1.19
        },
        "pro": {
          "reps": 1.12
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            15,
            30
          ],
          "for_time": [
            20,
            50
          ],
          "emom": [
            10,
            20
          ],
          "interval": [
            15,
            30
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_air_squat",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "walking_lunge",
      "name": "Lunges",
      "family": "bodyweight",
      "pattern": [
        "lunge"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 5,
      "weight_hybrid": 5,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 2.08
        },
        "inter": {
          "reps": 1.84
        },
        "rx": {
          "reps": 1.6
        },
        "rxplus": {
          "reps": 1.47
        },
        "elite": {
          "reps": 1.36
        },
        "pro": {
          "reps": 1.28
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            16,
            30
          ],
          "for_time": [
            20,
            50
          ],
          "emom": [
            12,
            20
          ],
          "interval": [
            16,
            30
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_lunge",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "cluster",
      "name": "Cluster",
      "family": "barbell",
      "pattern": [
        "squat",
        "hinge",
        "push_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.85
        },
        "inter": {
          "reps": 5.17
        },
        "rx": {
          "reps": 4.5
        },
        "rxplus": {
          "reps": 4.14
        },
        "elite": {
          "reps": 3.82
        },
        "pro": {
          "reps": 3.6
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            50,
            35
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            60,
            43
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            70,
            50
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            80,
            55
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            90,
            60
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            100,
            70
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            5,
            10
          ],
          "for_time": [
            6,
            15
          ],
          "emom": [
            3,
            6
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "squat clean + thruster",
      "muscu": null
    },
    {
      "id": "hang_clean_and_jerk",
      "name": "Hang Clean & Jerk",
      "family": "barbell",
      "pattern": [
        "hinge",
        "push_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.85
        },
        "inter": {
          "reps": 5.17
        },
        "rx": {
          "reps": 4.5
        },
        "rxplus": {
          "reps": 4.14
        },
        "elite": {
          "reps": 3.82
        },
        "pro": {
          "reps": 3.6
        }
      },
      "loads": {
        "scaled": {
          "light": [
            30,
            20
          ],
          "medium": [
            40,
            30
          ],
          "heavy": [
            60,
            40
          ]
        },
        "inter": {
          "light": [
            35,
            25
          ],
          "medium": [
            50,
            35
          ],
          "heavy": [
            80,
            55
          ]
        },
        "rx": {
          "light": [
            43,
            30
          ],
          "medium": [
            60,
            43
          ],
          "heavy": [
            100,
            70
          ]
        },
        "rxplus": {
          "light": [
            50,
            35
          ],
          "medium": [
            70,
            50
          ],
          "heavy": [
            120,
            80
          ]
        },
        "elite": {
          "light": [
            55,
            40
          ],
          "medium": [
            80,
            55
          ],
          "heavy": [
            140,
            95
          ]
        },
        "pro": {
          "light": [
            60,
            43
          ],
          "medium": [
            90,
            60
          ],
          "heavy": [
            160,
            110
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            4,
            10
          ],
          "for_time": [
            5,
            12
          ],
          "emom": [
            3,
            6
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_cj",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "kb_snatch",
      "name": "KB Snatch",
      "family": "kettlebell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 6,
      "weight_hybrid": 3,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_kb_snatch",
      "active": true,
      "version": 2,
      "notes": "altern\xE9, reps au total",
      "muscu": null
    },
    {
      "id": "kb_clean",
      "name": "KB Clean",
      "family": "kettlebell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 4,
      "weight_hybrid": 2,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "altern\xE9, reps au total",
      "muscu": null
    },
    {
      "id": "kb_front_squat",
      "name": "KB Front Squat",
      "family": "kettlebell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 3,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.64
        },
        "inter": {
          "reps": 3.22
        },
        "rx": {
          "reps": 2.8
        },
        "rxplus": {
          "reps": 2.58
        },
        "elite": {
          "reps": 2.38
        },
        "pro": {
          "reps": 2.24
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            20
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "2 KB, charge par main",
      "muscu": null
    },
    {
      "id": "kb_clean_and_jerk",
      "name": "KB Clean & Jerk",
      "family": "kettlebell",
      "pattern": [
        "hinge",
        "push_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 5,
      "weight_hybrid": 3,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.9
        },
        "inter": {
          "reps": 3.45
        },
        "rx": {
          "reps": 3
        },
        "rxplus": {
          "reps": 2.76
        },
        "elite": {
          "reps": 2.55
        },
        "pro": {
          "reps": 2.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            12,
            8
          ],
          "medium": [
            16,
            12
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            24,
            16
          ],
          "medium": [
            28,
            20
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            24,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            8,
            20
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_kb_cj",
      "active": true,
      "version": 2,
      "notes": "2 KB ou altern\xE9 1 KB",
      "muscu": null
    },
    {
      "id": "kb_deadlift",
      "name": "KB Deadlift",
      "family": "kettlebell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 4,
      "weight_hybrid": 4,
      "equipment": [
        "kettlebell"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.34
        },
        "inter": {
          "reps": 2.07
        },
        "rx": {
          "reps": 1.8
        },
        "rxplus": {
          "reps": 1.66
        },
        "elite": {
          "reps": 1.53
        },
        "pro": {
          "reps": 1.44
        }
      },
      "loads": {
        "scaled": {
          "light": [
            16,
            12
          ],
          "medium": [
            20,
            16
          ],
          "heavy": [
            20,
            16
          ]
        },
        "inter": {
          "light": [
            20,
            16
          ],
          "medium": [
            24,
            16
          ],
          "heavy": [
            24,
            16
          ]
        },
        "rx": {
          "light": [
            24,
            16
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            32,
            24
          ]
        },
        "rxplus": {
          "light": [
            28,
            20
          ],
          "medium": [
            32,
            24
          ],
          "heavy": [
            32,
            24
          ]
        },
        "elite": {
          "light": [
            32,
            24
          ],
          "medium": [
            40,
            28
          ],
          "heavy": [
            40,
            28
          ]
        },
        "pro": {
          "light": [
            32,
            24
          ],
          "medium": [
            40,
            28
          ],
          "heavy": [
            40,
            28
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            15,
            30
          ],
          "emom": [
            8,
            15
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "2 KB, charge par main",
      "muscu": null
    },
    {
      "id": "box_jump_over_step_down",
      "name": "Box Jump Over Step Down",
      "family": "box",
      "pattern": [
        "squat",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "cm",
      "weight_functional": 6,
      "weight_hybrid": 4,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 4.42
        },
        "inter": {
          "reps": 3.91
        },
        "rx": {
          "reps": 3.4
        },
        "rxplus": {
          "reps": 3.13
        },
        "elite": {
          "reps": 2.89
        },
        "pro": {
          "reps": 2.72
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            40
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            50,
            40
          ]
        },
        "inter": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rx": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rxplus": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "elite": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        },
        "pro": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": {
        "scaled": "box_step_over"
      },
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "burpee_box_jump",
      "name": "Burpee Box Jump",
      "family": "bodyweight",
      "pattern": [
        "core",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "cm",
      "weight_functional": 6,
      "weight_hybrid": 4,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 7.15
        },
        "inter": {
          "reps": 6.32
        },
        "rx": {
          "reps": 5.5
        },
        "rxplus": {
          "reps": 5.06
        },
        "elite": {
          "reps": 4.67
        },
        "pro": {
          "reps": 4.4
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            40
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            50,
            40
          ]
        },
        "inter": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rx": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rxplus": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "elite": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        },
        "pro": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            8,
            20
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_burpee_bj",
      "active": true,
      "version": 2,
      "notes": null,
      "muscu": null
    },
    {
      "id": "burpee_over_the_bar",
      "name": "Burpees Over the Bar",
      "family": "bodyweight",
      "pattern": [
        "core",
        "mono"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 7,
      "weight_hybrid": 2,
      "equipment": [
        "barbell"
      ],
      "cadence": {
        "scaled": {
          "reps": 5.46
        },
        "inter": {
          "reps": 4.83
        },
        "rx": {
          "reps": 4.2
        },
        "rxplus": {
          "reps": 3.86
        },
        "elite": {
          "reps": 3.57
        },
        "pro": {
          "reps": 3.36
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_burpee",
      "active": true,
      "version": 2,
      "notes": "lat\xE9ral",
      "muscu": null
    },
    {
      "id": "pull_up_banded",
      "name": "Banded Pull-Ups",
      "family": "gym",
      "pattern": [
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 1,
      "equipment": [
        "rig",
        "band"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.6
        },
        "inter": {
          "reps": 2.3
        },
        "rx": {
          "reps": 2
        },
        "rxplus": {
          "reps": 1.84
        },
        "elite": {
          "reps": 1.7
        },
        "pro": {
          "reps": 1.6
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution",
      "muscu": null
    },
    {
      "id": "hanging_knee_raise",
      "name": "Hanging Knee Raises",
      "family": "gym",
      "pattern": [
        "core",
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 1,
      "equipment": [
        "rig"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.08
        },
        "inter": {
          "reps": 1.84
        },
        "rx": {
          "reps": 1.6
        },
        "rxplus": {
          "reps": 1.47
        },
        "elite": {
          "reps": 1.36
        },
        "pro": {
          "reps": 1.28
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            15
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "hip_flexors"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "legless_rope_climb",
      "name": "Legless Rope Climbs",
      "family": "gym",
      "pattern": [
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 0,
      "equipment": [
        "rope"
      ],
      "cadence": {
        "scaled": {
          "reps": 26
        },
        "inter": {
          "reps": 23
        },
        "rx": {
          "reps": 20
        },
        "rxplus": {
          "reps": 18.4
        },
        "elite": {
          "reps": 17
        },
        "pro": {
          "reps": 16
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            1,
            3
          ],
          "for_time": [
            1,
            4
          ],
          "emom": [
            1,
            1
          ],
          "interval": [
            1,
            2
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "variante haute",
      "muscu": null
    },
    {
      "id": "ring_dip_banded",
      "name": "Banded Ring Dips",
      "family": "gym",
      "pattern": [
        "push_v"
      ],
      "modality": "G",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 0,
      "equipment": [
        "rings",
        "band"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            9,
            21
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution",
      "muscu": null
    },
    {
      "id": "box_pistol",
      "name": "Box Pistols",
      "family": "bodyweight",
      "pattern": [
        "squat"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 1,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.25
        },
        "inter": {
          "reps": 2.88
        },
        "rx": {
          "reps": 2.5
        },
        "rxplus": {
          "reps": 2.3
        },
        "elite": {
          "reps": 2.12
        },
        "pro": {
          "reps": 2
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            20
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution",
      "muscu": null
    },
    {
      "id": "pistol_to_box",
      "name": "Pistols To Box",
      "family": "bodyweight",
      "pattern": [
        "squat"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 1,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.64
        },
        "inter": {
          "reps": 3.22
        },
        "rx": {
          "reps": 2.8
        },
        "rxplus": {
          "reps": 2.58
        },
        "elite": {
          "reps": 2.38
        },
        "pro": {
          "reps": 2.24
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            6,
            12
          ],
          "for_time": [
            8,
            20
          ],
          "emom": [
            4,
            8
          ],
          "interval": [
            5,
            10
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution",
      "muscu": null
    },
    {
      "id": "half_wall_walk",
      "name": "Half Wall Walks",
      "family": "gym",
      "pattern": [
        "push_v",
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 1,
      "equipment": [
        "wall"
      ],
      "cadence": {
        "scaled": {
          "reps": 13
        },
        "inter": {
          "reps": 11.5
        },
        "rx": {
          "reps": 10
        },
        "rxplus": {
          "reps": 9.2
        },
        "elite": {
          "reps": 8.5
        },
        "pro": {
          "reps": 8
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            6
          ],
          "for_time": [
            4,
            10
          ],
          "emom": [
            2,
            4
          ],
          "interval": [
            3,
            5
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution",
      "muscu": null
    },
    {
      "id": "pike_push_up",
      "name": "Pike Push-Ups",
      "family": "bodyweight",
      "pattern": [
        "push_v"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 3,
      "weight_hybrid": 2,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.86
        },
        "inter": {
          "reps": 2.53
        },
        "rx": {
          "reps": 2.2
        },
        "rxplus": {
          "reps": 2.02
        },
        "elite": {
          "reps": 1.87
        },
        "pro": {
          "reps": 1.76
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            21
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution HSPU",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "knee_push_up",
      "name": "Knee Push-Ups",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 2,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 2.08
        },
        "inter": {
          "reps": 1.84
        },
        "rx": {
          "reps": 1.6
        },
        "rxplus": {
          "reps": 1.47
        },
        "elite": {
          "reps": 1.36
        },
        "pro": {
          "reps": 1.28
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution",
      "muscu": null
    },
    {
      "id": "bear_crawl",
      "name": "Bear Crawl",
      "family": "bodyweight",
      "pattern": [
        "core",
        "push_h"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 3,
      "equipment": [],
      "cadence": {
        "scaled": {
          "m": 1.95
        },
        "inter": {
          "m": 1.72
        },
        "rx": {
          "m": 1.5
        },
        "rxplus": {
          "m": 1.38
        },
        "elite": {
          "m": 1.27
        },
        "pro": {
          "m": 1.2
        }
      },
      "loads": null,
      "rep_ranges": {
        "m": {
          "amrap": [
            10,
            25
          ],
          "for_time": [
            10,
            50
          ],
          "emom": [
            10,
            20
          ],
          "interval": [
            10,
            20
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution HS walk",
      "muscu": null
    },
    {
      "id": "inchworm",
      "name": "Inchworms",
      "family": "bodyweight",
      "pattern": [
        "core",
        "push_h"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 2,
      "equipment": [],
      "cadence": {
        "scaled": {
          "reps": 6.5
        },
        "inter": {
          "reps": 5.75
        },
        "rx": {
          "reps": 5
        },
        "rxplus": {
          "reps": 4.6
        },
        "elite": {
          "reps": 4.25
        },
        "pro": {
          "reps": 4
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            5,
            10
          ],
          "for_time": [
            5,
            15
          ],
          "emom": [
            3,
            6
          ],
          "interval": [
            4,
            8
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution wall walk",
      "muscu": null
    },
    {
      "id": "handstand_shoulder_tap",
      "name": "Handstand Shoulder Taps",
      "family": "gym",
      "pattern": [
        "push_v",
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 0,
      "equipment": [
        "wall"
      ],
      "cadence": {
        "scaled": {
          "reps": 1.56
        },
        "inter": {
          "reps": 1.38
        },
        "rx": {
          "reps": 1.2
        },
        "rxplus": {
          "reps": 1.1
        },
        "elite": {
          "reps": 1.02
        },
        "pro": {
          "reps": 0.96
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            10,
            20
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            6,
            12
          ],
          "interval": [
            8,
            16
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution HS walk",
      "muscu": null
    },
    {
      "id": "box_step_over",
      "name": "Box Step Over",
      "family": "box",
      "pattern": [
        "lunge"
      ],
      "modality": "M",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "cm",
      "weight_functional": 3,
      "weight_hybrid": 4,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 3.64
        },
        "inter": {
          "reps": 3.22
        },
        "rx": {
          "reps": 2.8
        },
        "rxplus": {
          "reps": 2.58
        },
        "elite": {
          "reps": 2.38
        },
        "pro": {
          "reps": 2.24
        }
      },
      "loads": {
        "scaled": {
          "light": [
            50,
            40
          ],
          "medium": [
            50,
            40
          ],
          "heavy": [
            50,
            40
          ]
        },
        "inter": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rx": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "rxplus": {
          "light": [
            60,
            50
          ],
          "medium": [
            60,
            50
          ],
          "heavy": [
            60,
            50
          ]
        },
        "elite": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        },
        "pro": {
          "light": [
            75,
            60
          ],
          "medium": [
            75,
            60
          ],
          "heavy": [
            75,
            60
          ]
        }
      },
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            30
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution BJO",
      "muscu": null
    },
    {
      "id": "rope_pull_from_floor",
      "name": "Rope Pulls From Floor",
      "family": "gym",
      "pattern": [
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 0,
      "equipment": [
        "rope"
      ],
      "cadence": {
        "scaled": {
          "reps": 7.8
        },
        "inter": {
          "reps": 6.9
        },
        "rx": {
          "reps": 6
        },
        "rxplus": {
          "reps": 5.52
        },
        "elite": {
          "reps": 5.1
        },
        "pro": {
          "reps": 4.8
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            3,
            6
          ],
          "for_time": [
            3,
            10
          ],
          "emom": [
            2,
            4
          ],
          "interval": [
            2,
            5
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution rope climb",
      "muscu": null
    },
    {
      "id": "box_dip",
      "name": "Box Dips",
      "family": "bodyweight",
      "pattern": [
        "push_v"
      ],
      "modality": "G",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 2,
      "weight_hybrid": 1,
      "equipment": [
        "box"
      ],
      "cadence": {
        "scaled": {
          "reps": 2.34
        },
        "inter": {
          "reps": 2.07
        },
        "rx": {
          "reps": 1.8
        },
        "rxplus": {
          "reps": 1.66
        },
        "elite": {
          "reps": 1.53
        },
        "pro": {
          "reps": 1.44
        }
      },
      "loads": null,
      "rep_ranges": {
        "reps": {
          "amrap": [
            8,
            15
          ],
          "for_time": [
            10,
            25
          ],
          "emom": [
            5,
            10
          ],
          "interval": [
            6,
            12
          ]
        }
      },
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 2,
      "notes": "substitution ring dip",
      "muscu": null
    },
    {
      "id": "back_rack_split_jerk",
      "name": "Back Rack Split Jerk",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_press",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "clean_pull",
      "name": "Clean Pull",
      "family": "barbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_clean_pull",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "db_deadlift",
      "name": "DB Deadlift",
      "family": "dumbbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "db_push_press",
      "name": "DB Push Press",
      "family": "dumbbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_db_push_press",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "db_strict_press",
      "name": "DB Strict Press",
      "family": "dumbbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_db_strict_press",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "power_jerk",
      "name": "Power Jerk",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_press",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "snatch_balance",
      "name": "Snatch Balance",
      "family": "barbell",
      "pattern": [
        "squat",
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_snatch_balance",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "snatch_high_pull",
      "name": "Snatch High Pull",
      "family": "barbell",
      "pattern": [
        "hinge",
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_snatch_hp",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "split_jerk",
      "name": "Split Jerk",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_press",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "squat_clean_and_jerk",
      "name": "Squat Clean & Jerk",
      "family": "barbell",
      "pattern": [
        "squat",
        "hinge",
        "push_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "strict_press",
      "name": "Strict Press",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_strict_press",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps",
          "tronc"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "press",
        "rm_factor": 1,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "tall_clean",
      "name": "Tall Clean",
      "family": "barbell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_clean",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "v_ups",
      "name": "V-ups",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_vup",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "zercher_squat",
      "name": "Zercher Squat",
      "family": "barbell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_squat",
      "active": false,
      "version": 1,
      "notes": "Ancien catalogue app \u2014 badges / back-office uniquement",
      "muscu": null
    },
    {
      "id": "incline_bench_press",
      "name": "Incline Bench Press",
      "family": "barbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "bench_incline",
        "rack"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "epaules_ant",
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "bench",
        "rm_factor": 0.8,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "db_bench_press",
      "name": "DB Bench Press",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps",
          "epaules_ant"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "incline_db_press",
      "name": "Incline DB Press",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench_incline"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "epaules_ant",
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "machine_chest_press",
      "name": "Machine Chest Press",
      "family": "machine",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "chest_press_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "cable_fly",
      "name": "Cable Fly",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "pec_deck",
      "name": "Pec Deck",
      "family": "machine",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pec_deck"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "db_fly",
      "name": "DB Fly",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "dips",
      "name": "Dips",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dip_station"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 lest\xE9 possible en force",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps",
          "epaules_ant"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "db_shoulder_press",
      "name": "DB Shoulder Press",
      "family": "dumbbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_db_strict_press",
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "arnold_press",
      "name": "Arnold Press",
      "family": "dumbbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "lateral_raise",
      "name": "Lateral Raise",
      "family": "dumbbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_lateral_raise",
      "name": "Cable Lateral Raise",
      "family": "cable",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "rear_delt_fly",
      "name": "Rear Delt Fly",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules_post",
        "muscle_secondary": [
          "haut_dos"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "face_pull",
      "name": "Face Pull",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules_post",
        "muscle_secondary": [
          "haut_dos"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "front_raise",
      "name": "Front Raise",
      "family": "dumbbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules_ant",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "landmine_press",
      "name": "Landmine Press",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "landmine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "pecs",
          "tronc"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "cable_triceps_pushdown",
      "name": "Triceps Pushdown",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "overhead_triceps_extension",
      "name": "Overhead Triceps Extension",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "skull_crusher",
      "name": "Skull Crushers",
      "family": "barbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "close_grip_bench",
      "name": "Close Grip Bench Press",
      "family": "barbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "bench",
        "rack"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [
          "pecs"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "bench",
        "rm_factor": 0.85,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "bench_dip",
      "name": "Bench Dips",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "barbell_row",
      "name": "Barbell Row",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps",
          "epaules_post"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 0.5,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "pendlay_row",
      "name": "Pendlay Row",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 0.5,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "db_row",
      "name": "DB Row",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "lat_pulldown",
      "name": "Lat Pulldown",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "lat_pulldown"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "seated_cable_row",
      "name": "Seated Cable Row",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable_row"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps",
          "epaules_post"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "chest_supported_row",
      "name": "Chest Supported Row",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench_incline"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps",
          "epaules_post"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 25,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "t_bar_row",
      "name": "T-Bar Row",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "landmine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "machine_row",
      "name": "Machine Row",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "row_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "strict_pull_up",
      "name": "Strict Pull-Ups",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_pullup",
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 lest\xE9 possible en force ; sub d\xE9butant : lat pulldown ou banded",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "chin_up",
      "name": "Chin-Ups",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "straight_arm_pulldown",
      "name": "Straight Arm Pulldown",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "rack_pull",
      "name": "Rack Pull",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "rack"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "ischios",
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 1.1,
        "seconds_per_rep": 3,
        "setup_s": 60,
        "objectives": [
          "force"
        ],
        "rep_ranges": {
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "back_extension",
      "name": "Back Extension",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "ghd"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "lombaires",
        "muscle_secondary": [
          "fessiers",
          "ischios"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "barbell_curl",
      "name": "Barbell Curl",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "db_curl",
      "name": "DB Curl",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "hammer_curl",
      "name": "Hammer Curl",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "avant_bras"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "incline_db_curl",
      "name": "Incline DB Curl",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench_incline"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_curl",
      "name": "Cable Curl",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "preacher_curl",
      "name": "Preacher Curl",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "preacher_bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "leg_press",
      "name": "Leg Press",
      "family": "machine",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "leg_press"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 40,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "hack_squat",
      "name": "Hack Squat",
      "family": "machine",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "hack_squat"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 40,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "bulgarian_split_squat",
      "name": "Bulgarian Split Squat",
      "family": "dumbbell",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "romanian_deadlift",
      "name": "Romanian Deadlift",
      "family": "barbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "ischios",
        "muscle_secondary": [
          "fessiers",
          "lombaires"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 0.7,
        "seconds_per_rep": 4,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "db_rdl",
      "name": "DB Romanian Deadlift",
      "family": "dumbbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "ischios",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "leg_extension",
      "name": "Leg Extension",
      "family": "machine",
      "pattern": [
        "squat"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "leg_extension"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "leg_curl",
      "name": "Leg Curl",
      "family": "machine",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "leg_curl"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "ischios",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "hip_thrust",
      "name": "Hip Thrust",
      "family": "barbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "hip_thrust",
        "rm_factor": 1,
        "seconds_per_rep": 3,
        "setup_s": 60,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "glute_bridge",
      "name": "Glute Bridge",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "good_morning",
      "name": "Good Morning",
      "family": "barbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "rack"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "ischios",
        "muscle_secondary": [
          "lombaires"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
        "setup_s": 30,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "sumo_deadlift",
      "name": "Sumo Deadlift",
      "family": "barbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios",
          "quadriceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 1,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "force",
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "standing_calf_raise",
      "name": "Standing Calf Raise",
      "family": "machine",
      "pattern": [
        "mono"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "calf_machine",
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "mollets",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "seated_calf_raise",
      "name": "Seated Calf Raise",
      "family": "machine",
      "pattern": [
        "mono"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "calf_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "mollets",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "nordic_curl",
      "name": "Nordic Curl",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "ischios",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "avance",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 5,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "hanging_leg_raise",
      "name": "Hanging Leg Raise",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "hip_flexors"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_crunch",
      "name": "Cable Crunch",
      "family": "cable",
      "pattern": [
        "core"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "ab_wheel",
      "name": "Ab Wheel Rollout",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "ab_wheel"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "lats"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "pallof_press",
      "name": "Pallof Press",
      "family": "cable",
      "pattern": [
        "core"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable",
        "band"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "dead_bug",
      "name": "Dead Bug",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "side_plank",
      "name": "Side Plank",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 secondes",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "s"
      }
    },
    {
      "id": "russian_twist",
      "name": "Russian Twist",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "wallball",
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "obliques"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 10,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "suitcase_carry",
      "name": "Suitcase Carry",
      "family": "carry",
      "pattern": [
        "core"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "m",
      "units_allowed": [
        "m"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "kettlebell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 m\xE8tres",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "obliques"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 20,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "m"
      }
    },
    {
      "id": "decline_bench_press",
      "name": "Decline Bench Press",
      "family": "barbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "bench_decline",
        "rack"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "bench",
        "rm_factor": 1.05,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "decline_db_press",
      "name": "Decline DB Press",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench_decline"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "machine_incline_press",
      "name": "Machine Incline Press",
      "family": "machine",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "chest_press_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "epaules_ant",
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "db_pullover",
      "name": "DB Pullover",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "dos",
          "triceps"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_pullover",
      "name": "Cable Pullover",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "dos"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "incline_db_fly",
      "name": "Incline DB Fly",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench_incline"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "low_cable_fly",
      "name": "Low To High Cable Fly",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "epaules_ant"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "wide_push_up",
      "name": "Wide Push-Ups",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "decline_push_up",
      "name": "Decline Push-Ups",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "box"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "epaules_ant",
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "machine_shoulder_press",
      "name": "Machine Shoulder Press",
      "family": "machine",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "shoulder_press_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "behind_neck_press",
      "name": "Behind The Neck Press",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "rack"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "avance",
        "load_mode": "1rm",
        "rm_reference": "press",
        "rm_factor": 0.85,
        "seconds_per_rep": 3,
        "setup_s": 45,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "upright_row",
      "name": "Upright Row",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "trapezes"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "bent_over_lateral_raise",
      "name": "Bent Over Lateral Raise",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules_post",
        "muscle_secondary": [
          "haut_dos"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "one_arm_incline_lateral_raise",
      "name": "Incline One-Arm Lateral Raise",
      "family": "dumbbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench_incline"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "avance",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "rear_delt_machine",
      "name": "Rear Delt Machine",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pec_deck"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules_post",
        "muscle_secondary": [
          "haut_dos"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "barbell_front_raise",
      "name": "Barbell Front Raise",
      "family": "barbell",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules_ant",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_front_raise",
      "name": "Cable Front Raise",
      "family": "cable",
      "pattern": [
        "push_v"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "epaules_ant",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "external_rotation",
      "name": "External Rotation (L-Fly)",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable",
        "band",
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "coiffe",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "internal_rotation",
      "name": "Internal Rotation",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable",
        "band"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "coiffe",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "yates_row",
      "name": "Yates Row",
      "family": "barbell",
      "pattern": [
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [
          "dos",
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 0.5,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "supinated_barbell_row",
      "name": "Supinated Barbell Row",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps",
          "trapezes"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 0.45,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "one_arm_machine_row",
      "name": "One-Arm Machine Row",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "row_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "one_arm_cable_row",
      "name": "One-Arm Cable Row",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable_row"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "barbell_shrug",
      "name": "Barbell Shrug",
      "family": "barbell",
      "pattern": [
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "1rm",
        "rm_reference": "deadlift",
        "rm_factor": 0.6,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "db_shrug",
      "name": "DB Shrug",
      "family": "dumbbell",
      "pattern": [
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "machine_shrug",
      "name": "Machine Shrug",
      "family": "machine",
      "pattern": [
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "shrug_machine",
        "calf_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_shrug",
      "name": "Cable Shrug",
      "family": "cable",
      "pattern": [
        "pull_v"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "wide_grip_pull_up",
      "name": "Wide Grip Pull-Ups",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "neutral_grip_pull_up",
      "name": "Neutral Grip Pull-Ups",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "close_grip_pull_up",
      "name": "Close Grip Pull-Ups",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "machine_pullover",
      "name": "Machine Pullover",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pullover_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "pecs"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "converging_pulldown",
      "name": "Converging Machine Pulldown",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "lat_pulldown"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "one_arm_pulldown",
      "name": "One-Arm Lat Pulldown",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "close_grip_pulldown",
      "name": "Close Grip Lat Pulldown",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "lat_pulldown"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "supinated_pulldown",
      "name": "Supinated Lat Pulldown",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "lat_pulldown"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "low_cable_skull_crusher",
      "name": "Lying Cable Triceps Extension",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 25,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "machine_dips",
      "name": "Machine Dips",
      "family": "machine",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dip_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [
          "pecs"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "close_grip_dips",
      "name": "Close Grip Dips",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dip_station"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [
          "pecs"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "wall_triceps_extension",
      "name": "Wall Triceps Extension",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_overhead_extension",
      "name": "Cable Overhead Triceps Extension",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "one_arm_overhead_extension",
      "name": "One-Arm Overhead Triceps Extension",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "machine_triceps_extension",
      "name": "Machine Triceps Extension",
      "family": "machine",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "triceps_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "diamond_push_up",
      "name": "Diamond Push-Ups",
      "family": "bodyweight",
      "pattern": [
        "push_h"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [
          "pecs"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "tate_press",
      "name": "Tate Press",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "avance",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "rope_pushdown",
      "name": "Rope Triceps Pushdown",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "one_arm_pushdown",
      "name": "One-Arm Triceps Pushdown",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "reverse_grip_pushdown",
      "name": "Reverse Grip Pushdown",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "db_kickback",
      "name": "DB Kickback",
      "family": "dumbbell",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_kickback",
      "name": "Cable Kickback",
      "family": "cable",
      "pattern": [
        "push_h"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "low",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "preacher_barbell_curl",
      "name": "Preacher Barbell Curl",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "preacher_bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cross_body_hammer_curl",
      "name": "Cross-Body Hammer Curl",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "avant_bras"
        ],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "lying_cable_curl",
      "name": "Lying Cable Curl",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 25,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "spider_curl",
      "name": "Spider Curl",
      "family": "barbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "dumbbell",
        "bench_incline"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "rope_hammer_curl",
      "name": "Rope Hammer Curl",
      "family": "cable",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "avant_bras"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "machine_preacher_curl",
      "name": "Machine Preacher Curl",
      "family": "machine",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "preacher_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "concentration_curl",
      "name": "Concentration Curl",
      "family": "dumbbell",
      "pattern": [
        "pull_h"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "reverse_curl",
      "name": "Reverse Curl",
      "family": "barbell",
      "pattern": [
        "carry"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "avant_bras",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "wrist_curl",
      "name": "Wrist Curl",
      "family": "barbell",
      "pattern": [
        "carry"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "avant_bras",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "wrist_extension",
      "name": "Wrist Extension",
      "family": "barbell",
      "pattern": [
        "carry"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "barbell",
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "avant_bras",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "wrist_roller",
      "name": "Wrist Roller",
      "family": "other",
      "pattern": [
        "carry"
      ],
      "modality": "W",
      "grip": "high",
      "shoulder_load": "none",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "wrist_roller"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 secondes",
      "muscu": {
        "muscle_primary": "avant_bras",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 20,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "s"
      }
    },
    {
      "id": "abmat_crunch",
      "name": "AbMat Crunch",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "abmat"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "floor_crunch",
      "name": "Crunch",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "reverse_crunch",
      "name": "Reverse Crunch",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "hip_flexors"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "machine_crunch",
      "name": "Machine Crunch",
      "family": "machine",
      "pattern": [
        "core"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "ab_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "swiss_ball_crunch",
      "name": "Swiss Ball Crunch",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "swiss_ball"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "oblique_crunch",
      "name": "Oblique Crunch",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "hanging_oblique_raise",
      "name": "Hanging Oblique Knee Raise",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rig"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [
          "hip_flexors"
        ],
        "compound": false,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "rotation_machine",
      "name": "Torso Rotation Machine",
      "family": "machine",
      "pattern": [
        "core"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "rotation_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "vacuum",
      "name": "Stomach Vacuum",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 secondes",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "s"
      }
    },
    {
      "id": "crunch_with_rotation",
      "name": "Crunch With Rotation",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "dragon_flag",
      "name": "Dragon Flag",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "avance",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 5,
        "setup_s": 15,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "db_side_bend",
      "name": "DB Side Bend",
      "family": "dumbbell",
      "pattern": [
        "core"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 10,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "standing_rotation",
      "name": "Standing Broomstick Rotation",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pvc"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "oblique_bench_raise",
      "name": "Oblique Raise On Roman Chair",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "ghd"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [
          "lombaires"
        ],
        "compound": false,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "wall_sit",
      "name": "Wall Sit",
      "family": "bodyweight",
      "pattern": [
        "squat"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "wall"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 secondes",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "s"
      }
    },
    {
      "id": "single_leg_glute_bridge",
      "name": "Single-Leg Glute Bridge",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios"
        ],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 5,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "bodyweight_single_leg_rdl",
      "name": "Single-Leg RDL (bodyweight)",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "ischios",
        "muscle_secondary": [
          "fessiers",
          "tronc"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "bodyweight_calf_raise",
      "name": "Calf Raise (bodyweight)",
      "family": "bodyweight",
      "pattern": [
        "mono"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "mollets",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "superman",
      "name": "Superman Hold",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 secondes",
      "muscu": {
        "muscle_primary": "lombaires",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "s"
      }
    },
    {
      "id": "hollow_hold",
      "name": "Hollow Hold",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 secondes",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "s"
      }
    },
    {
      "id": "mountain_climber",
      "name": "Mountain Climbers",
      "family": "bodyweight",
      "pattern": [
        "core"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": "mv_mtclimber",
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "hip_flexors"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_pull_through",
      "name": "Cable Pull-Through",
      "family": "cable",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "hip_abduction_machine",
      "name": "Hip Abduction Machine",
      "family": "machine",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "abduction_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "cable_hip_abduction",
      "name": "Cable Hip Abduction",
      "family": "cable",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "banded_hip_abduction",
      "name": "Banded Hip Abduction",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "band"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "glute_kickback",
      "name": "Glute Kickback (c\xE2ble)",
      "family": "cable",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "cable"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "db_sumo_squat",
      "name": "DB Sumo Squat",
      "family": "dumbbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "kettlebell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "quadriceps",
          "adducteurs"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "frog_pump",
      "name": "Frog Pump",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 5,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps"
      }
    },
    {
      "id": "db_hip_thrust",
      "name": "DB Hip Thrust",
      "family": "dumbbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell",
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "single_leg_hip_thrust",
      "name": "Single-Leg Hip Thrust",
      "family": "bodyweight",
      "pattern": [
        "hinge"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "bench"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "reverse_lunge",
      "name": "DB Reverse Lunge",
      "family": "dumbbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "quadriceps"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 2,
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "step_up_high",
      "name": "High Box Step-Up",
      "family": "dumbbell",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "box",
        "dumbbell"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "quadriceps"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 20,
        "objectives": [
          "hypertrophie"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps"
      }
    },
    {
      "id": "hip_thrust_machine",
      "name": "Hip Thrust Machine",
      "family": "machine",
      "pattern": [
        "hinge"
      ],
      "modality": "W",
      "grip": "low",
      "shoulder_load": "none",
      "unit_default": "reps",
      "units_allowed": [
        "reps"
      ],
      "load_unit": "kg",
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "hip_thrust_machine"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation (M1) \u2014 jamais tir\xE9 en metcon",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "ischios"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "rpe",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 3,
        "setup_s": 30,
        "objectives": [
          "hypertrophie",
          "force",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            12
          ],
          "force": [
            3,
            5
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 0,
        "weight_gym": 8,
        "unit": "reps"
      }
    }
  ]
};

// packages/wod-engine/src/bank/functional/couplet_for_time_21_15_9.ts
var couplet_for_time_21_15_9 = {
  id: "couplet_for_time_21_15_9",
  discipline: "functional",
  format: "for_time",
  durations: [8, 12],
  intentions: ["mixed", "gym", "force"],
  band_by_intention: { mixed: "medium", force: "heavy", gym: "light" },
  scheme: [21, 15, 9],
  scheme_by_band: { heavy: [9, 7, 5] },
  rounds: "scheme",
  slots: [
    { pick: { family: ["barbell", "dumbbell"], pattern_any: ["squat", "hinge", "push_v"] }, qty: "scheme" },
    { pick: { family: ["gym"], pattern_any: ["pull_v", "push_v", "core"], pattern_not_of_slot: 0 }, qty: "scheme" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 9, note: "Sprint, sets courts d\xE8s le round 1." }
};

// packages/wod-engine/src/bank/functional/couplet_amrap_short.ts
var couplet_amrap_short = {
  id: "couplet_amrap_short",
  discipline: "functional",
  format: "amrap",
  durations: [8, 12],
  intentions: ["mixed", "cardio", "gym"],
  band_by_intention: { mixed: "medium", cardio: "light", gym: "light" },
  rounds: "amrap",
  slots: [
    { pick: { modality: ["W", "M"], pattern_any: ["squat", "hinge", "push_v", "mono"] }, qty: "range" },
    { pick: { modality: ["G", "M"], pattern_not_of_slot: 0 }, qty: "range" }
  ],
  score_type: "rounds_reps",
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: "Allure constante, pas de set cass\xE9 avant la mi-temps." }
};

// packages/wod-engine/src/bank/functional/triplet_amrap_mid.ts
var triplet_amrap_mid = {
  id: "triplet_amrap_mid",
  discipline: "functional",
  format: "amrap",
  durations: [12, 15, 20],
  intentions: ["mixed", "cardio"],
  band_by_intention: { mixed: "medium", cardio: "light" },
  rounds: "amrap",
  slots: [
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["barbell", "dumbbell", "kettlebell", "wallball"], pattern_any: ["squat", "hinge", "push_v"] }, qty: "range" },
    { pick: { family: ["gym", "bodyweight"], pattern_any: ["pull_v", "core", "mono"], pattern_not_of_slot: 1 }, qty: "range" }
  ],
  score_type: "rounds_reps",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 7.5, note: "Tenable 20 min, transitions rapides." }
};

// packages/wod-engine/src/bank/functional/triplet_rounds_for_time.ts
var triplet_rounds_for_time = {
  id: "triplet_rounds_for_time",
  discipline: "functional",
  format: "rounds_for_time",
  durations: [12, 15, 20],
  intentions: ["mixed", "force"],
  band_by_intention: { mixed: "medium", force: "heavy" },
  rounds: { min: 3, max: 5 },
  max_rounds_by_band: { heavy: 4 },
  slots: [
    { pick: { family: ["barbell"], pattern_any: ["hinge", "squat"] }, qty: "range" },
    { pick: { family: ["erg", "box", "jump_rope"] }, qty: "range" },
    { pick: { family: ["gym"], pattern_any: ["pull_v", "push_v"], no_shared_high_grip_with: 0 }, qty: "range" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8, note: "Rounds r\xE9guliers, la barre ne se pose pas avant la fin du set." }
};

// packages/wod-engine/src/bank/functional/chipper_descending.ts
var chipper_descending = {
  id: "chipper_descending",
  discipline: "functional",
  format: "chipper",
  durations: [15, 20],
  intentions: ["mixed", "cardio"],
  band_by_intention: { mixed: "medium", cardio: "light" },
  scheme: [50, 40, 30, 20, 10],
  rounds: "scheme",
  barbell_low_scheme: true,
  slots: [
    { pick: { family: ["erg"], unit: "cal" }, qty: "scheme" },
    { pick: { family: ["box", "jump_rope"] }, qty: "scheme" },
    { pick: { family: ["kettlebell", "dumbbell", "wallball"] }, qty: "scheme" },
    { pick: { family: ["barbell"], band: "light" }, qty: "scheme" },
    { pick: { family: ["bodyweight"], pattern_any: ["core", "mono"] }, qty: "scheme" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 7.5, note: "Gestion, pas de sprint avant le dernier tiers." }
};

// packages/wod-engine/src/bank/functional/chipper_stations_erg.ts
var chipper_stations_erg = {
  id: "chipper_stations_erg",
  discipline: "functional",
  format: "chipper",
  durations: [20, 30],
  intentions: ["mixed", "cardio"],
  band_by_intention: { mixed: "medium", cardio: "light" },
  rounds: { min: 1, max: 1 },
  slots: [
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["sled", "carry", "sandbag"], unit: "m" }, qty: "range" },
    { pick: { family: ["erg"], unit: "cal" }, qty: "range", role: "erg diff\xE9rent du (1)" },
    { pick: { family: ["kettlebell", "dumbbell", "wallball"] }, qty: "range" },
    { pick: { family: ["run"], unit: "m" }, qty: "range", qty_max: 800 },
    { pick: { family: ["bodyweight", "gym"], pattern_any: ["core", "pull_v", "push_v"] }, qty: "range" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 7, note: "Stations encha\xEEn\xE9es, ergs \xE0 85 %." }
};

// packages/wod-engine/src/bank/functional/emom_alternating.ts
var emom_alternating = {
  id: "emom_alternating",
  discipline: "functional",
  format: "emom",
  durations: [12, 15, 20],
  intentions: ["mixed", "gym", "force"],
  band_by_intention: { mixed: "medium", gym: "light", force: "heavy" },
  rest: { every_s: 60 },
  station_count: { by_duration: { 12: 3, 15: 3, 20: 4 } },
  max_station_work_s: 40,
  slots: [
    { pick: { family: ["barbell"] }, qty: "range" },
    { pick: { family: ["gym"] }, qty: "range" },
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["bodyweight"] }, qty: "range", optional: true }
  ],
  score_type: "reps_total",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 7, note: "Chaque station \u2264 40 s de travail, le repos est la consigne." }
};

// packages/wod-engine/src/bank/functional/interval_work_rest.ts
var interval_work_rest = {
  id: "interval_work_rest",
  discipline: "functional",
  format: "interval",
  durations: [15, 20],
  intentions: ["mixed", "cardio", "force"],
  band_by_intention: { mixed: "medium", cardio: "light", force: "heavy" },
  rest: { every_s: [180, 240] },
  rounds: { min: 4, max: 6 },
  max_work_fraction: 0.65,
  slots: [
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["barbell", "dumbbell"], pattern_any: ["hinge", "squat"] }, qty: "range" },
    { pick: { family: ["bodyweight"], pattern_any: ["mono"] }, qty: "range" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 9, note: "Chaque intervalle est un sprint, repos complet." }
};

// packages/wod-engine/src/bank/functional/ladder_ascending.ts
var ladder_ascending = {
  id: "ladder_ascending",
  discipline: "functional",
  format: "ladder",
  durations: [10, 15],
  intentions: ["mixed", "gym"],
  band_by_intention: { mixed: "medium", gym: "light" },
  scheme: [3, 6, 9],
  rounds: "scheme",
  slots: [
    { pick: { family: ["barbell", "dumbbell"], pattern_any: ["squat", "push_v", "hinge"] }, qty: "scheme" },
    { pick: { family: ["gym"], pattern_any: ["pull_v", "core"], pattern_not_of_slot: 0 }, qty: "scheme" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8, note: "Les premiers paliers se font sans poser la barre." }
};

// packages/wod-engine/src/bank/functional/death_by.ts
var death_by = {
  id: "death_by",
  discipline: "functional",
  format: "death_by",
  durations: [10, 15],
  intentions: ["mixed", "force"],
  band_by_intention: { mixed: "medium", force: "heavy" },
  rest: { every_s: 60 },
  slots: [
    { pick: { modality: ["M"], pattern_any: ["mono"], unit: "cal" }, qty: "fixed", fixed: 5, optional: true, role: "buy-in" },
    { pick: { family: ["barbell"], pattern_any: ["hinge", "squat", "push_v"] }, qty: "minute" }
  ],
  score_type: "reps_total",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 9, note: "S'arr\xEAte quand la minute n'est plus tenue." }
};

// packages/wod-engine/src/bank/functional/tabata_pair.ts
var tabata_pair = {
  id: "tabata_pair",
  discipline: "functional",
  format: "tabata",
  durations: [8, 10],
  intentions: ["cardio", "gym"],
  band_by_intention: { cardio: "light", gym: "light" },
  rest: { work_s: 20, rest_s: 10 },
  rounds: { min: 8, max: 8 },
  slots: [
    { pick: { family: ["bodyweight", "erg"] }, qty: "range" },
    { pick: { family: ["bodyweight", "gym"], pattern_not_of_slot: 0 }, qty: "range" }
  ],
  score_type: "reps_total",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: "Score = somme des reps min de chaque bloc." }
};

// packages/wod-engine/src/bank/functional/heavy_couplet.ts
var heavy_couplet = {
  id: "heavy_couplet",
  discipline: "functional",
  format: "rounds_for_time",
  durations: [10, 15],
  intentions: ["force"],
  band_by_intention: { force: "heavy" },
  rounds: { min: 5, max: 7 },
  slots: [
    { pick: { family: ["barbell"], pattern_any: ["hinge", "squat", "push_v"] }, qty: "range", reps_range: [3, 5] },
    { pick: { modality: ["M"], pattern_any: ["mono"], family: ["erg", "run", "jump_rope"] }, qty: "range" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: "Charge lourde, sets non cass\xE9s, le mono sert de r\xE9cup\xE9ration active." }
};

// packages/wod-engine/src/bank/functional/engine_long_amrap.ts
var engine_long_amrap = {
  id: "engine_long_amrap",
  discipline: "functional",
  format: "amrap",
  durations: [20, 30],
  intentions: ["cardio"],
  band_by_intention: { cardio: "light" },
  rounds: "amrap",
  slots: [
    { pick: { family: ["erg", "run"] }, qty: "range" },
    { pick: { family: ["bodyweight", "gym"], pattern_any: ["mono", "core", "pull_v", "push_v"] }, qty: "range" },
    { pick: { family: ["kettlebell", "wallball", "dumbbell"], band: "light" }, qty: "range" },
    { pick: { family: ["erg", "run"] }, qty: "range", role: "erg diff\xE9rent du (1) ou run" }
  ],
  score_type: "rounds_reps",
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 6.5, note: "Zone 3, respiration contr\xF4l\xE9e du d\xE9but \xE0 la fin." }
};

// packages/wod-engine/src/bank/functional/gym_density.ts
var gym_density = {
  id: "gym_density",
  discipline: "functional",
  format: "emom",
  durations: [10, 15],
  intentions: ["gym"],
  band_by_intention: { gym: "light" },
  rest: { every_s: 90 },
  max_station_work_s: 60,
  slots: [
    { pick: { family: ["gym"], pattern_any: ["pull_v", "push_v"] }, qty: "range", reps_range: [5, 12] },
    { pick: { ids: ["hollow_rock", "ghd_sit_up", "plank_hold", "toes_to_bar"], no_shared_high_grip_with: 0 }, qty: "range" }
  ],
  score_type: "reps_total",
  cap_factor: 1,
  allow_variant_up: true,
  stimulus: { rpe: 6.5, note: "Technique, aucun \xE9chec musculaire." }
};

// packages/wod-engine/src/bank/functional/stations_rotation.ts
var stations_rotation = {
  id: "stations_rotation",
  discipline: "functional",
  format: "stations",
  durations: [20, 30],
  intentions: ["mixed", "cardio"],
  band_by_intention: { mixed: "medium", cardio: "light" },
  rest: { work_s: [60, 90], rest_s: [15, 30] },
  rounds: { min: 2, max: 4 },
  station_count: { min: 4, max: 5 },
  no_consecutive_erg: true,
  slots: [
    { pick: { family: ["erg", "run"] }, qty: "range" },
    { pick: { family: ["kettlebell", "dumbbell", "wallball", "sandbag", "sled", "box"] }, qty: "range" },
    { pick: { family: ["erg", "run"] }, qty: "range", role: "erg diff\xE9rent du (1)" },
    { pick: { family: ["kettlebell", "dumbbell", "wallball", "sandbag", "sled", "box"], pattern_not_of_slot: 1 }, qty: "range" },
    { pick: { family: ["kettlebell", "dumbbell", "wallball", "sandbag", "sled", "box", "bodyweight", "gym"], pattern_not_of_slot: 3 }, qty: "range", optional: true }
  ],
  score_type: "reps_total",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: "Max effort sur chaque station, repos incomplet voulu." }
};

// packages/wod-engine/src/bank/hybrid/run_into_station.ts
var HYBRID_STATIONS = [
  "sled_push",
  "sled_pull",
  "sandbag_lunge",
  "db_farmer_carry",
  "wall_ball",
  "burpee_broad_jump",
  "ski_erg",
  "row"
];
var run_into_station = {
  id: "run_into_station",
  discipline: "hybrid",
  format: "rounds_for_time",
  durations: [20, 30, 45],
  intentions: ["interval", "engine", "run"],
  band_by_intention: { interval: "medium", engine: "light", run: "light" },
  rounds: { min: 4, max: 6 },
  slots: [
    { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed_range: [400, 800] },
    { pick: { ids: HYBRID_STATIONS, erg_unit: "m" }, qty: "range", rotate_per_round: true }
  ],
  score_type: "time",
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 8.5, note: "Allure course \xE0 90 % du 5 km, stations sans pause." }
};

// packages/wod-engine/src/bank/hybrid/stations_interval.ts
var POOL = ["ski_erg", "row", "bike_erg", "wall_ball", "burpee_broad_jump", "sandbag_lunge", "sled_push", "db_farmer_carry", "kb_swing_russian"];
var stations_interval = {
  id: "stations_interval",
  discipline: "hybrid",
  format: "stations",
  durations: [20, 30],
  intentions: ["interval"],
  band_by_intention: { interval: "medium" },
  rest: { work_s: 90, rest_s: 30 },
  rounds: { min: 2, max: 3 },
  station_count: { min: 4, max: 5 },
  no_consecutive_erg: true,
  slots: [
    { pick: { ids: POOL, erg_unit: "cal" }, qty: "range" },
    { pick: { ids: POOL, erg_unit: "cal", pattern_not_of_slot: 0 }, qty: "range" },
    { pick: { ids: POOL, erg_unit: "cal", pattern_not_of_slot: 1 }, qty: "range" },
    { pick: { ids: POOL, erg_unit: "cal", pattern_not_of_slot: 2 }, qty: "range" },
    { pick: { ids: POOL, erg_unit: "cal", pattern_not_of_slot: 3 }, qty: "range", optional: true }
  ],
  score_type: "reps_total",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 8.5, note: "Alternance jambes / \xE9paules / mono, 90 s de travail max effort." }
};

// packages/wod-engine/src/bank/hybrid/amrap_distances.ts
var amrap_distances = {
  id: "amrap_distances",
  discipline: "hybrid",
  format: "amrap",
  durations: [15, 20],
  intentions: ["interval", "engine"],
  band_by_intention: { interval: "medium", engine: "light" },
  rounds: "amrap",
  slots: [
    { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed_range: [200, 400] },
    { pick: { ids: ["sled_push", "sled_pull"], unit: "m" }, qty: "fixed", fixed_range: [25, 50] },
    { pick: { ids: ["wall_ball", "sandbag_lunge"] }, qty: "range" },
    { pick: { family: ["erg"], unit: "cal" }, qty: "fixed", fixed_range: [10, 20] }
  ],
  score_type: "rounds_reps",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: "Allure constante, chaque round dans les 15 s du pr\xE9c\xE9dent." }
};

// packages/wod-engine/src/bank/hybrid/erg_pyramid.ts
var erg_pyramid = {
  id: "erg_pyramid",
  discipline: "hybrid",
  format: "for_time",
  durations: [20, 30],
  intentions: ["engine", "aerobic"],
  band_by_intention: { engine: "light", aerobic: "light" },
  scheme: [250, 500, 750, 500, 250],
  rounds: "scheme",
  slots: [
    { pick: { ids: ["row", "ski_erg", "bike_erg"], unit: "m" }, qty: "scheme" },
    { pick: { ids: ["sandbag_lunge", "walking_lunge", "db_farmer_carry", "burpee_broad_jump"] }, qty: "fixed", fixed_by_id: { sandbag_lunge: 20, walking_lunge: 20, db_farmer_carry: 50, burpee_broad_jump: 10 }, role: "entre chaque palier" }
  ],
  score_type: "time",
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 7, note: "Pyramide \xE0 allure r\xE9guli\xE8re, la station courte relance sans casser le rythme." }
};

// packages/wod-engine/src/bank/hybrid/sled_repeats.ts
var sled_repeats = {
  id: "sled_repeats",
  discipline: "hybrid",
  format: "interval",
  durations: [15, 20],
  intentions: ["force", "interval"],
  band_by_intention: { force: "heavy", interval: "heavy" },
  rest: { every_s: 180 },
  rounds: { min: 5, max: 7 },
  max_work_fraction: 0.75,
  slots: [
    { pick: { ids: ["sled_push"], unit: "m" }, qty: "fixed", fixed_range: [25, 30] },
    { pick: { ids: ["sled_pull", "sandbag_carry"], unit: "m" }, qty: "fixed", fixed_by_id: { sled_pull: 25, sandbag_carry: 50 } },
    { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed_range: [100, 200] }
  ],
  score_type: "time",
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: "Lourd et court, repos r\xE9el entre les tours." }
};

// packages/wod-engine/src/bank/hybrid/compromised_run.ts
var compromised_run = {
  id: "compromised_run",
  discipline: "hybrid",
  format: "rounds_for_time",
  durations: [20, 30],
  intentions: ["interval", "run"],
  band_by_intention: { interval: "medium", run: "medium" },
  rounds: { min: 3, max: 4 },
  slots: [
    { pick: { ids: ["sled_push", "sandbag_lunge", "wall_ball", "db_farmer_carry"] }, qty: "range", role: "station lourde 60-90 s" },
    { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed_range: [600, 1e3] }
  ],
  score_type: "time",
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: "Courir vite sur des jambes fatigu\xE9es : allure 5 km + 15 s/km." }
};

// packages/wod-engine/src/bank/hybrid/half_sim.ts
var half_sim = {
  id: "half_sim",
  discipline: "hybrid",
  format: "rounds_for_time",
  // bank-v1 annonce 45' ; avec les cadences du catalogue 4 × (500 m + station) ≈ 16' RX → recalé sur 15/20.
  durations: [15, 20],
  intentions: ["interval"],
  band_by_intention: { interval: "medium" },
  rounds: { min: 4, max: 4 },
  slots: [],
  variants: [
    {
      id: "A",
      slots: [
        { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed_range: [500, 800] },
        {
          pick: { ids: ["ski_erg", "sled_push", "sled_pull", "burpee_broad_jump"], erg_unit: "m" },
          qty: "fixed",
          fixed_by_id: { ski_erg: 500, sled_push: 25, sled_pull: 25, burpee_broad_jump: 40 },
          rotate_per_round: true,
          role: "une station diff\xE9rente par round"
        }
      ]
    },
    {
      id: "B",
      slots: [
        { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed_range: [500, 800] },
        {
          pick: { ids: ["row", "db_farmer_carry", "sandbag_lunge", "wall_ball"], erg_unit: "m" },
          qty: "fixed",
          fixed_by_id: { row: 500, db_farmer_carry: 100, sandbag_lunge: 50, wall_ball: 50 },
          rotate_per_round: true,
          role: "une station diff\xE9rente par round"
        }
      ]
    }
  ],
  score_type: "time",
  cap_factor: 1.2,
  allow_variant_up: false,
  stimulus: { rpe: 9, note: "Demi-course, g\xE9rer comme un jour de comp\xE9tition." }
};

// packages/wod-engine/src/bank/hybrid/engine_continuous.ts
var engine_continuous = {
  id: "engine_continuous",
  discipline: "hybrid",
  format: "continuous",
  durations: [20, 30, 45],
  intentions: ["aerobic"],
  band_by_intention: { aerobic: "light" },
  rounds: { min: 1, max: 6 },
  slots: [
    { pick: { ids: ["row", "ski_erg"], unit: "m" }, qty: "fixed", fixed: 500 },
    { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed: 400 },
    { pick: { ids: ["bike_erg"], unit: "m" }, qty: "fixed", fixed: 1e3 },
    { pick: { ids: ["sandbag_carry", "db_farmer_carry"], unit: "m" }, qty: "fixed", fixed: 200, optional: true }
  ],
  station_count: { min: 3, max: 4 },
  score_type: "distance",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 6, note: "Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget." }
};

// packages/wod-engine/src/bank/hybrid/core_carry_finisher.ts
var core_carry_finisher = {
  id: "core_carry_finisher",
  discipline: "hybrid",
  format: "rounds_for_time",
  durations: [10, 15, 20],
  intentions: ["core"],
  band_by_intention: { core: "light" },
  rounds: { min: 3, max: 6 },
  slots: [
    { pick: { ids: ["db_farmer_carry", "sandbag_carry"], unit: "m" }, qty: "fixed", fixed_range: [50, 100] },
    { pick: { ids: ["hollow_rock", "plank_hold", "sit_up", "ghd_sit_up"] }, qty: "range" },
    { pick: { family: ["erg", "run"], pattern_any: ["mono"], erg_unit: "cal" }, qty: "range", optional: true, role: "mono" }
  ],
  score_type: "time",
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 6, note: "Posture et gainage, jamais \xE0 l'\xE9chec." }
};

// packages/wod-engine/src/bank/hybrid/run_intervals.ts
var run_intervals = {
  id: "run_intervals",
  discipline: "hybrid",
  format: "interval",
  durations: [10, 15, 20],
  intentions: ["run"],
  band_by_intention: { run: "light" },
  slots: [],
  variants: [
    { id: "A", slots: [{ pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed: 400 }], rounds: { min: 4, max: 8 }, rest: { rest_s: 60 } },
    { id: "B", slots: [{ pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed: 800 }], rounds: { min: 2, max: 5 }, rest: { rest_s: 90 } },
    { id: "C", slots: [{ pick: { ids: ["shuttle_run"], unit: "m" }, qty: "fixed", fixed: 200 }], rounds: { min: 6, max: 12 }, rest: { rest_s: 45 } }
  ],
  score_type: "time",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 8.5, note: "Allure 5 km ou plus vite, r\xE9gularit\xE9 entre r\xE9p\xE9titions." }
};

// packages/wod-engine/src/bank/muscu.ts
var slot = (role, muscle, opts = {}) => ({ role, muscle, ...opts });
var main = (m, o) => slot("main_compound", m, o);
var sec = (m, o) => slot("secondary_compound", m, o);
var iso = (m, o) => slot("isolation", m, o);
var core = (m, o) => slot("core", m, o);
var calves = (o) => slot("calves", "mollets", o);
var OPT = { optional: true };
var HIP_THRUST = ["hip_thrust", "db_hip_thrust", "hip_thrust_machine", "single_leg_hip_thrust", "glute_bridge", "single_leg_glute_bridge"];
var RDL = ["romanian_deadlift", "db_rdl", "good_morning", "bodyweight_single_leg_rdl"];
var ABDUCTION = ["hip_abduction_machine", "cable_hip_abduction", "banded_hip_abduction"];
var KICKBACK = ["glute_kickback", "cable_pull_through", "frog_pump"];
var LEG_CURL = ["leg_curl", "nordic_curl", "bodyweight_single_leg_rdl"];
var ANTI_ROTATION = ["pallof_press", "dead_bug", "plank_hold", "hollow_hold", "ab_wheel", "vacuum"];
var LATERAL = ["side_plank", "db_side_bend", "oblique_crunch", "hanging_oblique_raise", "oblique_bench_raise", "rotation_machine", "crunch_with_rotation", "standing_rotation"];
var CARRY = ["db_farmer_carry", "suitcase_carry"];
var VERTICAL_PULL = ["strict_pull_up", "chin_up", "wide_grip_pull_up", "neutral_grip_pull_up", "close_grip_pull_up", "lat_pulldown", "converging_pulldown", "close_grip_pulldown", "supinated_pulldown", "one_arm_pulldown"];
var TRICEPS_COMPOUND = ["close_grip_bench", "close_grip_dips", "machine_dips", "diamond_push_up", "dips"];
var T = {
  push: {
    hypertrophie: [main("pecs"), sec("epaules"), iso("pecs"), iso("epaules"), iso("triceps"), iso("triceps", OPT)],
    force: [main("pecs"), main("epaules"), sec("triceps", { ids: TRICEPS_COMPOUND }), iso("epaules_post", OPT), iso("triceps", OPT)],
    endurance: [sec("pecs"), sec("epaules"), iso("pecs"), iso("triceps"), iso("epaules", OPT)]
  },
  pull: {
    hypertrophie: [main("dos"), sec("dos", { ids: VERTICAL_PULL }), iso("epaules_post"), iso("biceps"), iso("biceps", OPT), iso("trapezes", OPT)],
    force: [main("dos"), main("dos", { ids: VERTICAL_PULL }), sec("trapezes", OPT), iso("biceps"), iso("epaules_post", OPT)],
    endurance: [sec("dos"), sec("dos", { ids: VERTICAL_PULL }), iso("epaules_post"), iso("biceps"), core(["tronc", "lombaires"], OPT)]
  },
  jambes: {
    hypertrophie: [main("quadriceps"), sec("ischios"), sec(["quadriceps", "fessiers"]), iso("quadriceps"), iso("ischios"), calves()],
    force: [main("quadriceps"), main(["ischios", "fessiers"]), sec("quadriceps", OPT), iso("ischios", OPT), calves(OPT)],
    endurance: [sec("quadriceps"), sec(["ischios", "fessiers"]), iso(["quadriceps", "fessiers"]), calves(), core("tronc", OPT)]
  },
  bas: {
    hypertrophie: [main("quadriceps"), sec("fessiers"), sec("ischios"), iso(["quadriceps", "fessiers"]), iso("ischios", OPT), core(["tronc", "lombaires"], OPT)],
    force: [main("quadriceps"), sec("ischios"), sec("fessiers", OPT), iso(["quadriceps", "fessiers"]), core(["lombaires", "tronc"], OPT)],
    endurance: [sec("quadriceps"), sec("fessiers"), iso(["ischios", "fessiers"]), core("tronc"), calves(OPT)]
  },
  full_body: {
    hypertrophie: [main("quadriceps"), main("pecs"), sec("dos"), sec(["ischios", "fessiers"]), iso("epaules", OPT), core("tronc", OPT)],
    force: [main("quadriceps"), main("pecs"), main("dos"), sec("ischios", OPT)],
    endurance: [sec(["quadriceps", "fessiers"]), sec("pecs"), sec("dos"), sec(["ischios", "fessiers"]), core("tronc", OPT)]
  },
  tronc: {
    hypertrophie: [core("tronc"), core(["obliques", "tronc"]), core("lombaires"), core("tronc", OPT)],
    force: [core("tronc"), core("obliques"), core("lombaires"), core("tronc", OPT)],
    endurance: [core("tronc", { ids: ANTI_ROTATION }), core(["obliques", "tronc"], { ids: LATERAL }), core("tronc", { ids: CARRY }), core("lombaires")]
  },
  haut: {
    hypertrophie: [main("pecs"), main("dos"), sec("epaules"), iso("biceps"), iso("triceps"), iso("epaules_post", OPT)],
    force: [main("pecs"), main("epaules"), main("dos"), sec("triceps", { ...OPT, ids: TRICEPS_COMPOUND }), iso("epaules_post", OPT)],
    endurance: [sec("pecs"), sec("dos"), sec("epaules"), iso(["biceps", "triceps"]), core("tronc", OPT)]
  },
  dos: {
    hypertrophie: [main("dos"), sec("dos", { ids: VERTICAL_PULL }), sec("dos", OPT), iso("epaules_post"), iso("trapezes", OPT), iso("lombaires", OPT)],
    force: [main("dos"), main("dos", { ids: VERTICAL_PULL }), sec("trapezes", OPT), iso("epaules_post", OPT), iso("lombaires", OPT)],
    endurance: [sec("dos"), sec("dos", { ids: VERTICAL_PULL }), iso("epaules_post"), iso("lombaires"), iso("trapezes", OPT)]
  },
  epaules: {
    hypertrophie: [main("epaules"), iso("epaules"), iso("epaules_post"), iso("epaules_ant", OPT), iso("trapezes", OPT)],
    force: [main("epaules"), sec("epaules", OPT), iso("epaules_post"), iso("epaules", OPT), iso("trapezes", OPT)],
    endurance: [sec("epaules"), iso("epaules"), iso("epaules_post"), iso("epaules_ant", OPT)]
  },
  bras: {
    hypertrophie: [sec("triceps", { ids: TRICEPS_COMPOUND }), iso("biceps"), iso("triceps"), iso("biceps"), iso("triceps", OPT), iso("avant_bras", OPT)],
    force: [main("triceps", { ids: TRICEPS_COMPOUND }), iso("biceps"), iso("triceps"), iso("biceps", OPT), iso("avant_bras", OPT)],
    endurance: [iso("triceps"), iso("biceps"), iso("triceps"), iso("biceps"), iso("avant_bras", OPT)]
  },
  pecs: {
    hypertrophie: [main("pecs"), sec("pecs"), iso("pecs"), iso("triceps"), iso("pecs", OPT)],
    force: [main("pecs"), sec("pecs", OPT), sec("triceps", { ids: TRICEPS_COMPOUND }), iso("pecs", OPT)],
    endurance: [sec("pecs"), sec("pecs"), iso("pecs"), iso("triceps", OPT)]
  },
  fessiers: {
    hypertrophie: [
      main("fessiers", { ids: HIP_THRUST, exclude_ids: ["back_squat"] }),
      sec("ischios", { ids: RDL }),
      sec("fessiers", { unilateral: true }),
      iso(["fessiers", "ischios"], { ids: [...KICKBACK, ...LEG_CURL] }),
      iso("fessiers", { ids: ABDUCTION }),
      iso("fessiers", { ...OPT, ids: KICKBACK })
    ],
    force: [main("fessiers", { exclude_ids: ["back_squat"] }), main("ischios", { ids: RDL }), sec("fessiers", { ...OPT, unilateral: true }), iso("fessiers", OPT), core("lombaires", OPT)],
    endurance: [sec("fessiers", { exclude_ids: ["back_squat"] }), sec("ischios"), iso("fessiers"), iso(["ischios", "fessiers"]), core("lombaires", OPT)]
  },
  fessiers_ischios: {
    hypertrophie: [main("ischios", { ids: RDL }), main("fessiers", { ids: HIP_THRUST }), sec(["fessiers", "ischios"], { unilateral: true }), iso("ischios", { ids: LEG_CURL }), iso("fessiers", { ids: ABDUCTION })],
    force: [main("ischios", { ids: RDL }), main("fessiers", { exclude_ids: ["back_squat"] }), sec(["fessiers", "ischios"], OPT), iso("ischios", OPT), core("lombaires", OPT)],
    endurance: [sec("ischios"), sec("fessiers"), iso("fessiers"), iso("ischios"), core("lombaires", OPT)]
  }
};
var MUSCU_TARGETS = Object.keys(T);
var MUSCU_OBJECTIVES = ["hypertrophie", "force", "endurance"];
var MUSCU_SKELETONS = MUSCU_TARGETS.flatMap((target) => MUSCU_OBJECTIVES.map((objective) => ({
  id: `${target}_${objective}`,
  discipline: "musculation",
  format: "strength_session",
  target,
  objective,
  slots: T[target][objective]
})));
var TARGET_MUSCLES = {
  fessiers: ["fessiers", "ischios", "lombaires"],
  fessiers_ischios: ["ischios", "fessiers", "lombaires"],
  bas: ["quadriceps", "fessiers", "ischios", "mollets", "lombaires"],
  full_body: ["quadriceps", "pecs", "dos", "ischios", "fessiers", "epaules", "tronc"],
  tronc: ["tronc", "obliques", "lombaires"],
  haut: ["pecs", "dos", "epaules", "biceps", "triceps", "epaules_post"],
  dos: ["dos", "epaules_post", "trapezes", "lombaires"],
  epaules: ["epaules", "epaules_post", "epaules_ant", "trapezes"],
  bras: ["biceps", "triceps", "avant_bras"],
  pecs: ["pecs", "triceps"],
  push: ["pecs", "epaules", "triceps", "epaules_post"],
  pull: ["dos", "epaules_post", "biceps", "trapezes"],
  jambes: ["quadriceps", "ischios", "fessiers", "mollets"]
};

// packages/wod-engine/src/bank/session.ts
var SESSION_BANK_VERSION = 1;
var WL_STEPS = [
  { sets: 2, reps: 2, percent: 30, rest_s: 60, note: "mont\xE9e" },
  { sets: 2, reps: 2, percent: 50, rest_s: 60, note: "mont\xE9e" },
  { sets: 4, reps: 1, percent: 65, rest_s: 180, note: "E3MOM \xB7 60-70 %" },
  { sets: 4, reps: 1, percent: 72, rest_s: 180, note: "E3MOM \xB7 70-75 %" }
];
var STRENGTH_RAMP = [
  { sets: 1, reps: 5, percent: 40, rest_s: 90, note: "mont\xE9e" },
  { sets: 1, reps: 5, percent: 50, rest_s: 90, note: "mont\xE9e" },
  { sets: 1, reps: 3, percent: 60, rest_s: 120, note: "mont\xE9e" }
];
var FIVE_BY_FIVE = [...STRENGTH_RAMP, { sets: 5, reps: 5, percent: 75, rest_s: 150 }];
var FIVE_BY_THREE = [...STRENGTH_RAMP, { sets: 5, reps: 3, percent: 82, rest_s: 180, note: "80-85 %" }];
var building = (id, movement, tempo, percent = 55) => ({
  id,
  movement,
  tempo,
  minutes: 8,
  steps: [{ sets: 3, reps: 5, percent, rest_s: 90, note: percent === null ? "strict, qualit\xE9 avant quantit\xE9" : "building tempo" }]
});
var S1_A = [
  {
    id: "snatch_complex_a",
    kind: "weightlifting",
    movement: "power_snatch",
    weeks: "even",
    minutes: 20,
    complex: ["hang_power_snatch", "power_snatch", "overhead_squat"],
    steps: WL_STEPS
  },
  {
    id: "snatch_complex_b",
    kind: "weightlifting",
    movement: "squat_snatch",
    weeks: "odd",
    minutes: 20,
    complex: ["power_snatch", "hang_power_snatch", "squat_snatch"],
    steps: WL_STEPS
  }
];
var S4_A = [
  {
    id: "cj_complex_a",
    kind: "weightlifting",
    movement: "clean_and_jerk",
    weeks: "even",
    minutes: 20,
    complex: ["power_clean", "front_squat", "push_jerk"],
    steps: WL_STEPS
  },
  {
    id: "cj_complex_b",
    kind: "weightlifting",
    movement: "clean_and_jerk",
    weeks: "odd",
    minutes: 20,
    complex: ["hang_power_clean", "squat_clean", "split_jerk"],
    steps: WL_STEPS
  }
];
var S2_A = [
  { id: "back_squat_5x5", kind: "strength", movement: "back_squat", weeks: "even", minutes: 18, steps: FIVE_BY_FIVE, tempo: "3-1-X-1" },
  { id: "front_squat_5x3", kind: "strength", movement: "front_squat", weeks: "odd", minutes: 18, steps: FIVE_BY_THREE, tempo: "2-1-X-1" }
];
var S5_A = [
  { id: "deadlift_5x3", kind: "strength", movement: "deadlift", weeks: "even", minutes: 18, steps: FIVE_BY_THREE, tempo: "2-0-X-2" },
  { id: "rdl_5x5", kind: "strength", movement: "romanian_deadlift", weeks: "odd", minutes: 18, steps: FIVE_BY_FIVE, tempo: "3-1-1-1" },
  { id: "sumo_5x5", kind: "strength", movement: "sumo_deadlift", weeks: "odd", minutes: 18, steps: FIVE_BY_FIVE, tempo: "2-0-X-2" }
];
var S3_A = [
  {
    id: "skill_c2b",
    kind: "skill",
    movement: "chest_to_bar",
    minutes: 15,
    skill: { reps: 5, rounds: 4, every_s: 90, substitutions: { scaled: "Banded Pull-Ups", inter: "Pull-ups", rxplus: "Chest-to-Bar", elite: "Bar Muscle-ups", pro: "Bar Muscle-ups" } }
  },
  {
    id: "skill_hspu",
    kind: "skill",
    movement: "handstand_push_up",
    minutes: 15,
    skill: { reps: 6, rounds: 4, every_s: 90, substitutions: { scaled: "Pike Push-Ups", inter: "Half Wall Walks", rxplus: "Strict Handstand Push-Ups", elite: "Strict Handstand Push-Ups", pro: "Strict Handstand Push-Ups" } }
  },
  {
    id: "skill_bmu",
    kind: "skill",
    movement: "bar_muscle_up",
    minutes: 15,
    skill: { reps: 3, rounds: 4, every_s: 90, substitutions: { scaled: "Banded Pull-Ups", inter: "Chest-to-Bar", rxplus: "Bar Muscle-ups", elite: "Ring Muscle-ups", pro: "Ring Muscle-ups" } }
  },
  {
    id: "skill_rope",
    kind: "skill",
    movement: "rope_climb",
    minutes: 15,
    skill: { reps: 2, rounds: 4, every_s: 90, substitutions: { scaled: "Rope Pulls From Floor", inter: "Rope Climbs", rxplus: "Rope Climbs", elite: "Legless Rope Climbs", pro: "Legless Rope Climbs" } }
  },
  {
    id: "skill_hs_walk",
    kind: "skill",
    movement: "handstand_walk",
    minutes: 15,
    skill: { reps: 10, rounds: 4, every_s: 90, substitutions: { scaled: "Handstand Shoulder Taps", inter: "Half Wall Walks", rxplus: "Handstand Walk", elite: "Handstand Walk", pro: "Handstand Walk" } }
  }
];
var CORE_FINISHERS = [
  { id: "core_hollow_plank", rounds: 3, minutes: 5, movements: [{ id: "hollow_rock", qty: 15, unit: "reps" }, { id: "plank_hold", qty: 30, unit: "s" }] },
  { id: "core_sit_up_superman", rounds: 3, minutes: 5, movements: [{ id: "sit_up", qty: 20, unit: "reps" }, { id: "superman", qty: 20, unit: "s" }] },
  { id: "core_ghd_hollow", rounds: 3, minutes: 5, movements: [{ id: "ghd_sit_up", qty: 12, unit: "reps" }, { id: "hollow_hold", qty: 30, unit: "s" }] }
];
var ACCESSORY_FINISHERS = [
  { id: "acc_carry_lunge", rounds: 3, minutes: 5, movements: [{ id: "db_farmer_carry", qty: 50, unit: "m" }, { id: "walking_lunge", qty: 20, unit: "reps" }] },
  { id: "acc_ring_row_pushup", rounds: 3, minutes: 5, movements: [{ id: "ring_row", qty: 12, unit: "reps" }, { id: "push_up", qty: 12, unit: "reps" }] },
  ...CORE_FINISHERS
];
var S1_snatch = {
  id: "S1_snatch",
  discipline: "session",
  format: "session",
  day: 1,
  label: "Halt\xE9ro \xB7 Snatch",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 mobilit\xE9 \xE9paules et hanches, barre \xE0 vide : Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance en s\xE9rie de 5."] },
  block_a: S1_A,
  block_b: [building("b_ohs_tempo", "overhead_squat", "3-1-1-1"), building("b_push_press_tempo_s1", "push_press", "2-0-1-2")],
  block_c: { intentions: ["mixed", "gym"], durations: [12, 15, 20], pattern_not: "heavy_pattern" },
  finisher: CORE_FINISHERS
};
var S2_squat = {
  id: "S2_squat",
  discipline: "session",
  format: "session",
  day: 2,
  label: "Force \xB7 Squat",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 v\xE9lo ou rameur facile, mobilit\xE9 chevilles et hanches, Air Squats, Goblet Squats l\xE9gers, activation fessiers."] },
  block_a: S2_A,
  block_b: [building("b_front_squat_tempo", "front_squat", "3-1-1-1"), building("b_ohs_pause", "overhead_squat", "3-2-1-1")],
  block_c: { intentions: ["cardio"], durations: [15, 20], pattern_not: "heavy_pattern" },
  finisher: CORE_FINISHERS
};
var S3_gym = {
  id: "S3_gym",
  discipline: "session",
  format: "session",
  day: 3,
  label: "Gym \xB7 Skill",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 mobilit\xE9 \xE9paules et poignets, Scap Pull-Ups, Kip Swings, Hollow / Arch, marche en HS contre le mur."] },
  block_a: S3_A,
  block_b: [building("b_strict_pull_up", "strict_pull_up", "2-1-2-1", null), building("b_ring_dip", "ring_dip", "2-1-2-1", null), building("b_strict_hspu", "strict_handstand_push_up", "2-1-2-1", null)],
  block_c: { intentions: ["gym", "mixed"], durations: [12, 15], formats: ["for_time", "amrap", "emom"], pattern_not: [] },
  finisher: ACCESSORY_FINISHERS
};
var S4_cj = {
  id: "S4_cj",
  discipline: "session",
  format: "session",
  day: 4,
  label: "Halt\xE9ro \xB7 Clean & Jerk",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 mobilit\xE9 poignets et hanches, barre \xE0 vide : Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk en s\xE9rie de 5."] },
  block_a: S4_A,
  block_b: [building("b_front_squat_pause", "front_squat", "2-2-X-1"), building("b_push_press_tempo", "push_press", "2-0-1-2")],
  block_c: { intentions: ["mixed"], durations: [15, 20], pattern_not: "heavy_pattern" },
  finisher: CORE_FINISHERS
};
var S5_hinge = {
  id: "S5_hinge",
  discipline: "session",
  format: "session",
  day: 5,
  label: "Force \xB7 Hinge",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 rameur facile, mobilit\xE9 ischios et hanches, Good Mornings barre \xE0 vide, Glute Bridges, Kettlebell Swings l\xE9gers."] },
  block_a: S5_A,
  block_b: [building("b_rdl_tempo", "romanian_deadlift", "3-1-1-1"), building("b_hip_thrust", "hip_thrust", "2-2-X-1")],
  block_c: { intentions: ["mixed", "cardio"], durations: [20, 30], formats: ["chipper", "stations"], pattern_not: "heavy_pattern" },
  finisher: null
};
var S6_long = {
  id: "S6_long",
  discipline: "session",
  format: "session",
  day: 6,
  label: "Long \xB7 Engine",
  budget_min: 60,
  warmup: { minutes: 18, lines: ["\xC9chauffement long (18') \u2014 3 tours faciles : 2' d'erg au choix, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats ; puis les mouvements du metcon \xE0 vide."] },
  block_a: null,
  block_b: null,
  block_c: { intentions: ["cardio", "mixed"], durations: [25, 30], pattern_not: [] },
  finisher: CORE_FINISHERS
};
var SESSION_SKELETONS = [S1_snatch, S2_squat, S3_gym, S4_cj, S5_hinge, S6_long];

// packages/wod-engine/src/bank/index.ts
var BANK_VERSION = 3;
var MUSCU_BANK_VERSION = 1;
var FUNCTIONAL_SKELETONS = [
  couplet_for_time_21_15_9,
  couplet_amrap_short,
  triplet_amrap_mid,
  triplet_rounds_for_time,
  chipper_descending,
  chipper_stations_erg,
  emom_alternating,
  interval_work_rest,
  ladder_ascending,
  death_by,
  tabata_pair,
  heavy_couplet,
  engine_long_amrap,
  gym_density,
  stations_rotation
];
var HYBRID_SKELETONS = [
  run_into_station,
  stations_interval,
  amrap_distances,
  erg_pyramid,
  sled_repeats,
  compromised_run,
  half_sim,
  engine_continuous,
  core_carry_finisher,
  run_intervals
];
var FUNCTIONAL_CAPS = {
  scaled: { reps: 60, cal: 60, m: 2e3, s: 240 },
  inter: { reps: 80, cal: 80, m: 2500, s: 300 },
  rx: { reps: 100, cal: 100, m: 3e3, s: 360 },
  rxplus: { reps: 120, cal: 120, m: 3500, s: 420 },
  elite: { reps: 150, cal: 150, m: 4e3, s: 480 },
  pro: { reps: 150, cal: 150, m: 4e3, s: 480 }
};
var HYBRID_CAPS = {
  women: { reps: 100, cal: 100, m: 6e3, s: 360 },
  men: { reps: 100, cal: 100, m: 6e3, s: 360 },
  women_pro: { reps: 120, cal: 120, m: 7e3, s: 420 },
  men_pro: { reps: 120, cal: 120, m: 7e3, s: 420 }
};
var MOVEMENT_CAPS = [
  { label: "HSPU", ids: ["handstand_push_up"], unit: "reps", rx: 45 },
  { label: "strict HSPU", ids: ["strict_handstand_push_up"], unit: "reps", rx: 20 },
  { label: "C2B", ids: ["chest_to_bar"], unit: "reps", rx: 60 },
  { label: "pull-ups", ids: ["pull_up"], unit: "reps", rx: 75 },
  { label: "T2B", ids: ["toes_to_bar"], unit: "reps", rx: 60 },
  { label: "BMU", ids: ["bar_muscle_up"], unit: "reps", rx: 20 },
  { label: "RMU", ids: ["ring_muscle_up"], unit: "reps", rx: 15 },
  { label: "rope climb", ids: ["rope_climb", "legless_rope_climb"], unit: "reps", rx: 8 },
  { label: "wall walk", ids: ["wall_walk"], unit: "reps", rx: 12 },
  { label: "HS walk", ids: ["handstand_walk"], unit: "m", rx: 60 },
  { label: "barre heavy", family: "barbell", band: "heavy", unit: "reps", rx: 25 },
  { label: "barre medium", family: "barbell", band: "medium", unit: "reps", rx: 60 },
  { label: "barre light", family: "barbell", band: "light", unit: "reps", rx: 90 },
  { label: "wall balls", ids: ["wall_ball"], unit: "reps", rx: 150 },
  { label: "devil press", ids: ["devil_press"], unit: "reps", rx: 30 },
  { label: "burpee box jump over", ids: ["burpee_box_jump_over"], unit: "reps", rx: 40 },
  { label: "box jump over", ids: ["box_jump_over"], unit: "reps", rx: 60 },
  { label: "DB snatch", ids: ["db_snatch"], unit: "reps", rx: 60 },
  { label: "burpees", ids: ["burpee", "bar_facing_burpee", "burpee_over_the_bar", "burpee_box_jump"], unit: "reps", rx: 60 }
];
var VOLUME_CAP_FACTOR = {
  scaled: 0.7,
  inter: 0.7,
  rx: 1,
  rxplus: 1,
  elite: 1.3,
  pro: 1.3,
  women: 1,
  men: 1,
  women_pro: 1.3,
  men_pro: 1.3
};
var BANK_V1 = {
  version: BANK_VERSION,
  skeletons: [...FUNCTIONAL_SKELETONS, ...HYBRID_SKELETONS],
  volume_caps: { functional: FUNCTIONAL_CAPS, hybrid: HYBRID_CAPS },
  movement_caps: MOVEMENT_CAPS,
  muscu_skeletons: MUSCU_SKELETONS,
  session_skeletons: SESSION_SKELETONS
};

// packages/wod-engine/src/bank/rows.ts
function isMuscuSkeletonRow(r) {
  return r.discipline === "musculation";
}
function isSessionSkeletonRow(r) {
  return r.discipline === "session";
}
function muscuSkeletonToRow(sk, version) {
  return { id: sk.id, discipline: "musculation", format: "strength_session", definition: sk, active: true, version };
}
function sessionSkeletonToRow(sk, version) {
  return { id: sk.id, discipline: "session", format: "session", definition: sk, active: true, version };
}
function skeletonToRow(sk, version) {
  return { id: sk.id, discipline: sk.discipline, format: sk.format, definition: sk, active: true, version };
}
function movementCapToRow(cap, version) {
  return {
    label: cap.label,
    ids: cap.ids ?? null,
    family: cap.family ?? null,
    band: cap.band ?? null,
    unit: cap.unit,
    rx_total: cap.rx,
    active: true,
    version
  };
}
function movementCapFromRow(r) {
  const cap = { label: r.label, unit: r.unit, rx: Number(r.rx_total) };
  if (r.ids && r.ids.length) cap.ids = r.ids;
  if (r.family) cap.family = r.family;
  if (r.band) cap.band = r.band;
  return cap;
}
function bankFromRows(skeletons, caps) {
  const metcon = skeletons.filter((r) => r.active && !isMuscuSkeletonRow(r) && !isSessionSkeletonRow(r));
  const muscu = skeletons.filter((r) => r.active && isMuscuSkeletonRow(r));
  const session = skeletons.filter((r) => r.active && isSessionSkeletonRow(r));
  const activeCaps = caps.filter((r) => r.active);
  if (metcon.length === 0 || activeCaps.length === 0) {
    throw new Error("wod_skeletons / wod_volume_caps vides");
  }
  const version = Math.max(...metcon.map((r) => r.version), ...activeCaps.map((r) => r.version));
  return {
    version,
    skeletons: metcon.map((r) => ({ ...r.definition, id: r.id, discipline: r.discipline, format: r.format })),
    volume_caps: BANK_V1.volume_caps,
    movement_caps: activeCaps.map(movementCapFromRow),
    // base antérieure à la migration 20261215 (aucune ligne musculation) → snapshot embarqué
    muscu_skeletons: muscu.length ? muscu.map((r) => ({ ...r.definition, id: r.id, discipline: "musculation", format: "strength_session" })) : BANK_V1.muscu_skeletons,
    session_skeletons: session.length ? session.map((r) => ({ ...r.definition, id: r.id, discipline: "session", format: "session" })) : BANK_V1.session_skeletons
  };
}

// packages/wod-engine/src/estimate.ts
var TRANSITION_S = 8;
var TIME_BOUNDED = /* @__PURE__ */ new Set([
  "amrap",
  "emom",
  "tabata",
  "death_by",
  "ladder",
  "continuous",
  "stations"
]);
function degradation(rounds) {
  return Math.min(1.3, 1 + 0.05 * (Math.max(1, rounds) - 1));
}
function cadence(m, category) {
  const c = m.cadence_by_category[category];
  if (c === void 0) throw new Error(`cadence manquante : ${m.id} / ${category}`);
  return c;
}
function movementSeconds(m, category, qty = m.qty) {
  return qty * cadence(m, category);
}
function roundSeconds(block, category) {
  const fixed = block.movements.filter((m) => m.round === void 0);
  const work = fixed.reduce((s, m) => s + movementSeconds(m, category), 0);
  return work + TRANSITION_S * fixed.length;
}
function fixedWorkSeconds(block, category) {
  const rounds = block.rounds ?? 1;
  const scheme = block.scheme;
  let total2 = 0;
  if (scheme && block.movements.some((m) => m.scheme)) {
    scheme.forEach((_, i) => {
      for (const m of block.movements) {
        const q = m.scheme ? m.scheme[i] : m.round === void 0 ? m.qty : 0;
        if (q > 0) total2 += movementSeconds(m, category, q) + TRANSITION_S;
      }
    });
    return total2 * degradation(scheme.length);
  }
  total2 = roundSeconds(block, category) * rounds;
  for (const m of block.movements) if (m.round !== void 0) total2 += movementSeconds(m, category) + TRANSITION_S;
  return total2 * degradation(rounds);
}
function ladderStep(block, category, budgetS) {
  return ladderProgress(block, category, budgetS).step;
}
function ladderProgress(block, category, budgetS) {
  const stepSeconds = (q) => block.movements.reduce((s, m) => s + movementSeconds(m, category, q) + TRANSITION_S, 0);
  const steps = [];
  if (block.ladder) for (let q = block.ladder.start, i = 0; i < 200; q += block.ladder.step, i++) steps.push(q);
  else steps.push(...block.scheme ?? []);
  let acc = 0;
  let step = 0;
  for (const q of steps) {
    const s = stepSeconds(q);
    if (acc + s > budgetS) return { step, partial: Math.max(0, Math.min(0.99, (budgetS - acc) / s)) };
    acc += s;
    step = q;
  }
  return { step, partial: 0 };
}
function deathByMinute(block, category, budgetMin) {
  const buyIn = block.movements.filter((m) => m.round === void 0 && m.qty > 0 && !m.per_minute);
  const main2 = block.movements.find((m) => m.per_minute);
  const buyS = buyIn.reduce((s, m) => s + movementSeconds(m, category) + TRANSITION_S, 0);
  let minute = 0;
  if (main2) {
    for (let n = 1; n <= budgetMin; n++) {
      if (buyS + movementSeconds(main2, category, n) > 60) break;
      minute = n;
    }
  }
  return minute;
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec2 = Math.round(s % 60);
  return `${m}:${sec2.toString().padStart(2, "0")}`;
}
function estimateBlock(block, category, budgetMin) {
  const f = block.format;
  const budgetS = budgetMin * 60;
  switch (f) {
    case "amrap": {
      const rs = roundSeconds(block, category);
      const rounds = budgetS / rs;
      return { minutes: budgetMin, target: `\u2248 ${Math.floor(rounds)} rounds` };
    }
    case "ladder": {
      const { step, partial } = ladderProgress(block, category, budgetS);
      const next = block.ladder ? step + block.ladder.step : step;
      const pct = Math.round(partial * 100);
      return { minutes: budgetMin, target: step ? pct >= 5 ? `palier ${step} + ${pct} % du palier ${next}` : `palier ${step}` : "palier 1 partiel" };
    }
    case "death_by": {
      const minute = deathByMinute(block, category, budgetMin);
      return { minutes: budgetMin, target: minute >= budgetMin ? `minute ${budgetMin} compl\xE9t\xE9e` : `minute ${minute}` };
    }
    case "emom": {
      const every = block.rest?.every_s ?? 60;
      const n = block.movements.length;
      const cycles = Math.floor(budgetS / every / n);
      const perStation = block.movements.map((m) => Math.round(movementSeconds(m, category)));
      return { minutes: budgetMin, target: `${cycles} passages, travail ${Math.min(...perStation)}-${Math.max(...perStation)} s / ${every} s` };
    }
    case "tabata": {
      return { minutes: budgetMin, target: "reps min sur 8 \xD7 20 s par bloc" };
    }
    case "stations": {
      const rounds = block.rounds ?? 1;
      const work = block.rest?.work_s ?? 60;
      const rest = block.rest?.rest_s ?? 0;
      const n = block.movements.length;
      const minutes = rounds * n * (work + rest) / 60;
      return { minutes, target: `${rounds} tours \xD7 ${n} stations, ${work} s on / ${rest} s off` };
    }
    case "continuous": {
      const cycle = roundSeconds(block, category);
      const dist = block.movements.filter((m) => m.unit === "m").reduce((s, m) => s + m.qty, 0);
      return { minutes: budgetMin, target: `\u2248 ${Math.round(budgetS / cycle * dist)} m` };
    }
    case "interval": {
      const rounds = block.rounds ?? 1;
      const workPer = roundSeconds(block, category);
      if (block.rest?.every_s) {
        const total3 = block.rest.every_s * rounds;
        return { minutes: total3 / 60, target: `travail \u2248 ${fmtTime(workPer)} par intervalle` };
      }
      const rest = block.rest?.rest_s ?? 0;
      const total2 = rounds * workPer + rest * (rounds - 1);
      return { minutes: total2 / 60, target: `\u2248 ${fmtTime(workPer)} par r\xE9p\xE9tition` };
    }
    default: {
      const s = fixedWorkSeconds(block, category);
      return { minutes: s / 60, target: `\u2248 ${fmtTime(s)}` };
    }
  }
}
function referenceCategory(wod) {
  return wod.discipline === "functional" ? "rx" : "men";
}
function estimateDuration(wod, category) {
  const block = wod.blocks[0];
  const est = estimateBlock(block, category, wod.budget_min);
  const ref = estimateBlock(block, referenceCategory(wod), wod.budget_min);
  return {
    by_category: { [category]: est },
    reference_minutes: ref.minutes,
    cap_minutes: wod.blocks[0].timecap != null ? wod.blocks[0].timecap / 60 : null
  };
}
function estimateAll(wod) {
  const block = wod.blocks[0];
  const by = {};
  for (const c of categoriesFor(wod.discipline)) by[c] = estimateBlock(block, c, wod.budget_min);
  const ref = estimateBlock(block, referenceCategory(wod), wod.budget_min);
  return {
    by_category: by,
    reference_minutes: ref.minutes,
    cap_minutes: block.timecap != null ? block.timecap / 60 : null
  };
}

// packages/wod-engine/src/signature.ts
function signature(wod) {
  const b = wod.blocks[0];
  const movs = b.movements.map((m) => (m.unit === "m" || m.unit === "cal") && m.qty > 0 ? `${m.id}:${m.qty}${m.unit}` : `${m.id}:${m.unit}`).join(",");
  return `${wod.discipline}|${wod.generator.skeleton_id}|${b.format}|${b.rounds ?? "-"}|${movs}`;
}

// packages/wod-engine/src/render.ts
var CATEGORY_LABEL = {
  scaled: "Scaled",
  inter: "Inter",
  rx: "RX",
  rxplus: "RX+",
  elite: "Elite",
  pro: "Pro",
  women: "Women",
  men: "Men",
  women_pro: "Women Pro",
  men_pro: "Men Pro"
};
var WOD_TYPE = {
  amrap: "amrap",
  for_time: "for-time",
  rounds_for_time: "for-time",
  chipper: "for-time",
  interval: "for-time",
  ladder: "amrap",
  continuous: "amrap",
  stations: "custom",
  emom: "emom",
  death_by: "emom",
  tabata: "tabata"
};
function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}
function mmss(s) {
  const m = Math.floor(s / 60);
  const sec2 = Math.round(s % 60);
  return sec2 ? `${m}:${sec2.toString().padStart(2, "0")}` : `${m}'`;
}
function loadText(m, discipline) {
  if (!m.load_unit) return null;
  const pair = discipline === "functional" ? m.loads_by_category.rx : [m.loads_by_category.men?.[0], m.loads_by_category.women?.[0]];
  if (!pair || pair.some((v) => v === void 0 || v === null)) return null;
  const vals = pair;
  return `${vals.map(fmtNum).join("/")} ${m.load_unit}`;
}
function qtyText(m) {
  if (m.unit === "reps") return `${m.qty}`;
  return `${m.qty} ${m.unit}`;
}
function movementLine(m, wod) {
  const load = loadText(m, wod.discipline);
  const base = `${qtyText(m)} ${m.name}`;
  return load ? `${base} (${load})` : base;
}
function loadsByCategoryLine(m, wod) {
  if (!m.load_unit) return null;
  const cats = wod.discipline === "functional" ? FUNCTIONAL_CATEGORIES : HYBRID_CATEGORIES;
  const ref = wod.discipline === "functional" ? "rx" : "men";
  const refVal = JSON.stringify(m.loads_by_category[ref]);
  const parts = [];
  if (wod.discipline === "functional") {
    let differs = false;
    for (const c of cats) {
      if (c === ref) continue;
      const v = m.loads_by_category[c];
      if (!v) continue;
      if (JSON.stringify(v) !== refVal) differs = true;
      parts.push(`${CATEGORY_LABEL[c]} ${v.map(fmtNum).join("/")}`);
    }
    if (!differs) return null;
  } else {
    const pro = [m.loads_by_category.men_pro?.[0], m.loads_by_category.women_pro?.[0]];
    const std = [m.loads_by_category.men?.[0], m.loads_by_category.women?.[0]];
    if (JSON.stringify(pro) === JSON.stringify(std) || pro.some((v) => v == null)) return null;
    parts.push(`Pro ${pro.map(fmtNum).join("/")}`);
  }
  return parts.length ? `${parts.join(" \xB7 ")} ${m.load_unit}` : null;
}
function substitutionLine(m) {
  const parts = [];
  const seen = /* @__PURE__ */ new Map();
  for (const [c, name] of Object.entries(m.substitutions_by_category)) {
    if (!name || name === m.name) continue;
    seen.set(name, [...seen.get(name) ?? [], CATEGORY_LABEL[c]]);
  }
  for (const [name, cats] of seen) parts.push(`${cats.join("/")} : ${name}`);
  const vars = /* @__PURE__ */ new Map();
  for (const [c, name] of Object.entries(m.variant_by_category)) {
    if (!name) continue;
    vars.set(name, [...vars.get(name) ?? [], CATEGORY_LABEL[c]]);
  }
  for (const [name, cats] of vars) parts.push(`${cats.join("/")} : ${name}`);
  return parts.length ? parts.join(" \xB7 ") : null;
}
function schemeText(b) {
  const unit = b.movements.find((m) => m.scheme)?.unit;
  const suffix = unit && unit !== "reps" ? ` ${unit}` : "";
  return `${(b.scheme ?? []).join("-")}${suffix}`;
}
function header(wod, b) {
  const cap = b.timecap != null ? ` (cap ${mmss(b.timecap)})` : "";
  const rounds = b.rounds ?? 0;
  switch (b.format) {
    case "amrap":
      return [`AMRAP ${wod.budget_min}`];
    case "for_time":
      return [b.scheme ? `For time \xB7 ${schemeText(b)}${cap}` : `For time${cap}`];
    case "rounds_for_time":
      return [`${rounds} rounds for time${cap}`];
    case "chipper":
      return [`Chipper \xB7 for time${cap}`];
    case "ladder":
      return b.ladder ? [`Ladder ${b.ladder.start}-${b.ladder.start + b.ladder.step}-${b.ladder.start + 2 * b.ladder.step}\u2026 \xB7 AMRAP ${wod.budget_min}`, `Monter les paliers (+${b.ladder.step} \xE0 chaque palier) jusqu'au temps, score = reps totales`] : [`Ladder ${schemeText(b)} \xB7 AMRAP ${wod.budget_min}`, "Monter les paliers dans le temps imparti, score = reps totales"];
    case "emom":
      return [`EMOM ${wod.budget_min}${b.rest?.every_s && b.rest.every_s !== 60 ? ` \xB7 every ${mmss(b.rest.every_s)}` : ""} \xB7 ${b.movements.length} stations en alternance`];
    case "death_by":
      return [`EMOM ${wod.budget_min} \xB7 Death by : +1 rep par minute jusqu'\xE0 l'\xE9chec`];
    case "tabata":
      return [`Tabata \xD7 2 blocs \xB7 8 \xD7 20 s / 10 s${b.rest?.transition_s ? `, transition ${b.rest.transition_s} s` : ""}`];
    case "interval": {
      if (b.rest?.every_s) return [`${rounds} rounds \xB7 every ${mmss(b.rest.every_s)}`];
      return [`${rounds} rounds \xB7 repos ${mmss(b.rest?.rest_s ?? 60)} entre les r\xE9p\xE9titions`];
    }
    case "stations":
      return [`${rounds} rounds \xD7 ${b.movements.length} stations \xB7 ${b.rest?.work_s ?? 60} s on / ${b.rest?.rest_s ?? 0} s off`];
    case "continuous":
      return [`En continu ${wod.budget_min}' \xB7 rotation sans repos, score = distance totale`];
  }
}
function bodyLines(wod, b) {
  const out = [];
  const push = (m, line) => {
    out.push(line);
    const loads = loadsByCategoryLine(m, wod);
    const subs = substitutionLine(m);
    if (loads) out.push(loads);
    if (subs) out.push(subs);
  };
  b.movements.forEach((m, i) => {
    const load = loadText(m, wod.discipline);
    const withLoad = (s) => load ? `${s} (${load})` : s;
    if (b.format === "tabata") push(m, `Tabata ${i + 1} \xB7 ${withLoad(m.name)} (${m.unit === "s" ? "tenue 20 s" : "max reps"})`);
    else if (b.format === "stations") push(m, `Station ${i + 1} \xB7 ${withLoad(m.name)} (${m.unit === "s" ? "tenue" : `max ${m.unit}, cible ${qtyText(m)}`})`);
    else if (m.round !== void 0) push(m, `R${m.round} \xB7 ${movementLine(m, wod)}`);
    else if (m.scheme) push(m, withLoad(m.name));
    else if (b.format === "for_time" && b.scheme) push(m, `${movementLine(m, wod)} (entre chaque palier)`);
    else if (m.per_minute) push(m, `${withLoad(m.name)} \xB7 min 1 : 1 rep, +1 rep par minute`);
    else if (b.format === "death_by") push(m, `${movementLine(m, wod)} (avant chaque s\xE9rie)`);
    else if (b.format === "emom") push(m, `Min ${i + 1} \xB7 ${movementLine(m, wod)}`);
    else push(m, movementLine(m, wod));
  });
  return out;
}
function footer(wod, b) {
  const out = [];
  if (wod.vest) {
    const men = wod.vest.load_kg_by_category.men ?? 9;
    const women = wod.vest.load_kg_by_category.women ?? 6;
    out.push(wod.vest.mode === "required" ? `Gilet lest\xE9 ${men}/${women} kg` : `Gilet lest\xE9 optionnel ${men}/${women} kg`);
  }
  const ref = wod.discipline === "functional" ? "rx" : "men";
  const target = wod.estimate.by_category[ref]?.target;
  const scored = b.format === "for_time" || b.format === "rounds_for_time" || b.format === "chipper";
  out.push(`Stimulus : RPE ${fmtNum(wod.stimulus.rpe)} \u2014 ${wod.stimulus.note}${target ? ` Cible ${CATEGORY_LABEL[ref]} : ${target}${scored && b.timecap != null ? `, cap ${mmss(b.timecap)}` : ""}.` : ""}`);
  return out;
}
function titleOf(wod, b) {
  const names = [...new Set(b.movements.filter((m) => m.round === void 0 || m.round === 1).map((m) => m.name))].slice(0, 3);
  const label = {
    amrap: `AMRAP ${wod.budget_min}`,
    for_time: b.scheme ? b.scheme.join("-") : "For time",
    rounds_for_time: `${b.rounds} rounds`,
    chipper: "Chipper",
    ladder: "Ladder",
    emom: `EMOM ${wod.budget_min}`,
    death_by: "Death by",
    tabata: "Tabata",
    interval: "Intervalles",
    stations: "Stations",
    continuous: "Continu"
  };
  return `${label[b.format]} \xB7 ${names.join(" / ")}`;
}
function render(wod) {
  const b = wod.blocks[0];
  const lines = [...header(wod, b), ...bodyLines(wod, b), ...footer(wod, b)];
  return {
    ...wod,
    title: titleOf(wod, b),
    description: lines.join("\n"),
    wod_type: WOD_TYPE[b.format],
    block_name: "wod",
    time_cap_seconds: b.timecap ?? wod.budget_min * 60,
    rounds: b.rounds,
    notes: `${wod.stimulus.note} Score : ${wod.score_type}.`,
    video_url: null,
    leaderboard_enabled: true,
    emom_interval_minutes: b.format === "emom" || b.format === "death_by" ? (b.rest?.every_s ?? 60) / 60 : null,
    tabata_work_seconds: b.format === "tabata" ? b.rest?.work_s ?? 20 : null,
    tabata_rest_seconds: b.format === "tabata" ? b.rest?.rest_s ?? 10 : null
  };
}
function movementLines(wod) {
  return bodyLines(wod, wod.blocks[0]);
}

// packages/wod-engine/src/generate.ts
var ENGINE_VERSION = "1.1.0";
var MAX_ATTEMPTS = 200;
var TOLERANCE = 0.1;
var DEFAULT_BAND = {
  mixed: "medium",
  cardio: "light",
  force: "heavy",
  gym: "light",
  interval: "medium",
  engine: "light",
  aerobic: "light",
  run: "light",
  core: "light"
};
var FORMAT_CHOICES = {
  amrap: ["amrap"],
  for_time: ["for_time", "rounds_for_time", "ladder"],
  emom: ["emom", "death_by"],
  chipper: ["chipper"],
  stations: ["stations", "continuous"],
  interval: ["interval", "tabata"]
};
var RANGE_FORMAT = {
  amrap: "amrap",
  for_time: "for_time",
  rounds_for_time: "for_time",
  chipper: "for_time",
  ladder: "for_time",
  emom: "emom",
  death_by: "emom",
  tabata: "emom",
  interval: "interval",
  stations: "interval",
  continuous: "interval"
};
var EQUIPMENT_FAMILIES = /* @__PURE__ */ new Set([
  "barbell",
  "dumbbell",
  "kettlebell",
  "erg",
  "run",
  "sled",
  "carry",
  "sandbag",
  "wallball",
  "jump_rope",
  "box"
]);
var NEVER_EXCLUDED = /* @__PURE__ */ new Set(["core", "mono"]);
var EQUIPMENT_FALLBACK = {
  bar_facing_burpee: "burpee",
  burpee_over_the_bar: "burpee",
  burpee_box_jump_over: "burpee",
  burpee_box_jump: "burpee"
};
var FORCE_FAMILIES = /* @__PURE__ */ new Set(["barbell", "kettlebell", "dumbbell", "sandbag", "sled"]);
var CARDIO_EXCLUDED_IDS = /* @__PURE__ */ new Set([
  "bar_muscle_up",
  "ring_muscle_up",
  "rope_climb",
  "legless_rope_climb",
  "wall_walk",
  "handstand_walk",
  "strict_handstand_push_up",
  "squat_snatch",
  "squat_clean",
  "cluster"
]);
var CONTINUOUS_FORMATS = /* @__PURE__ */ new Set(["amrap", "for_time", "rounds_for_time", "chipper", "ladder", "continuous"]);
var RACK_ONLY_IDS = /* @__PURE__ */ new Set(["back_squat", "bench_press"]);
var RACK_FORMATS = /* @__PURE__ */ new Set(["emom", "interval", "stations"]);
var ENGINE_MIN_SHARE = 0.4;
var RUN_MIN_M = 200;
function heavyAllowed(sk, budget_min) {
  return budget_min <= 15 || sk.id === "heavy_couplet" || !CONTINUOUS_FORMATS.has(sk.format);
}
function rackAllowed(sk) {
  return sk.id === "heavy_couplet" || RACK_FORMATS.has(sk.format);
}
var VEST_LOAD_KG = {
  scaled: 6,
  inter: 6,
  rx: 9,
  rxplus: 9,
  elite: 9,
  pro: 9,
  women: 6,
  men: 9,
  women_pro: 6,
  men_pro: 9
};
var AFTER_CLASS_DURATIONS = [10, 15, 20];
var Reject = class extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
};
function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function stripLine(line) {
  return line.replace(/^\s*(?:R\d+|Min \d+|Station \d+)\s*·\s*/i, "").replace(/^\s*\d+(?:\s*\/\s*\d+)?\s*(?:cal|kcal|m|s|sec|reps?)?\.?\s+/i, "").replace(/\s*[(@].*$/, "").trim();
}
function afterClassFilter(catalog, dayMovements) {
  const patterns = /* @__PURE__ */ new Set();
  const families = /* @__PURE__ */ new Set();
  const equipment = /* @__PURE__ */ new Set();
  for (const raw of dayMovements) {
    const m = resolveMovement(catalog, raw) ?? resolveMovement(catalog, stripLine(raw));
    if (!m) continue;
    for (const p of m.pattern) if (!NEVER_EXCLUDED.has(p)) patterns.add(p);
    if (EQUIPMENT_FAMILIES.has(m.family)) {
      families.add(m.family);
      for (const e of m.equipment) equipment.add(norm(e));
    }
  }
  if (patterns.has("squat")) patterns.add("lunge");
  if (patterns.has("lunge")) patterns.add("squat");
  return { patterns, families, equipment };
}
function substitutionOnlyIds(catalog, discipline) {
  const targets = /* @__PURE__ */ new Set();
  for (const m of catalog.movements) {
    if (m.substitutions) {
      for (const id of Object.values(m.substitutions)) if (id && id !== m.id) targets.add(id);
    }
    if (m.variant_up) targets.add(m.variant_up);
  }
  const out = /* @__PURE__ */ new Set();
  for (const m of catalog.movements) if (targets.has(m.id) && weightFor(m, discipline) <= 3) out.add(m.id);
  return out;
}
function isExcluded(ctx, m) {
  if (ctx.exclude.size === 0) return false;
  return ctx.exclude.has(m.id) || ctx.exclude.has(norm(m.name)) || ctx.exclude.has(m.family);
}
function equipmentExcluded(ctx, m) {
  for (const e of m.equipment) {
    const k = norm(e);
    if (ctx.exclude.has(k) || (ctx.afterClass?.equipment.has(k) ?? false)) return true;
  }
  return false;
}
function constrainBand(band, params, sk) {
  if (params.entry === "after_class") return "light";
  if (params.intention === "force" && band === "light") band = "medium";
  if (band === "heavy" && !heavyAllowed(sk, params.budget_min)) band = "medium";
  return band;
}
function forceBand(params, sk) {
  if (params.entry === "after_class") return "light";
  return heavyAllowed(sk, params.budget_min) ? "heavy" : "medium";
}
function isSlowSkill(m) {
  return CARDIO_EXCLUDED_IDS.has(m.id);
}
var SLOT_INTENTIONS = /* @__PURE__ */ new Set(["force", "gym", "core", "engine", "run"]);
function carriesIntention(params, m, band, sk) {
  switch (params.intention) {
    case "force":
      return FORCE_FAMILIES.has(m.family) && m.loads !== null && band === forceBand(params, sk);
    case "gym":
      return m.family === "gym" && m.pattern.some((p) => p === "pull_v" || p === "push_v");
    case "core":
      return m.pattern.includes("core");
    case "engine":
      return m.family === "erg" || m.family === "run";
    case "run":
      return m.family === "run";
    default:
      return true;
  }
}
function engineShare(catalog, block, category) {
  let total2 = 0;
  let engine = 0;
  const rounds = block.rounds ?? 1;
  for (const gm of block.movements) {
    const w = (gm.round !== void 0 ? 1 / rounds : 1) * movementSeconds(gm, category);
    total2 += w;
    const fam = movementById(catalog, gm.id)?.family;
    if (fam === "erg" || fam === "run") engine += w;
  }
  return total2 > 0 ? engine / total2 : 0;
}
function effectiveBand(sk, params) {
  return constrainBand(sk.band_by_intention[params.intention] ?? DEFAULT_BAND[params.intention], params, sk);
}
function formatsFor(choice) {
  if (!choice || choice === "surprise") return null;
  return FORMAT_CHOICES[choice];
}
function candidateTiers(params, bank) {
  const banned = new Set(params.skeleton_not ?? []);
  const all = bank.skeletons.filter((s) => s.discipline === params.discipline && !banned.has(s.id));
  const base = all.filter((s) => s.intentions.includes(params.intention));
  const formats = formatsFor(params.format);
  const near = (d) => Math.abs(d - params.budget_min) <= 5;
  const acDur = (s) => params.entry !== "after_class" || s.durations.some((d) => AFTER_CLASS_DURATIONS.includes(d));
  const steps = [
    [[], base, (s) => s.durations.includes(params.budget_min) && (!formats || formats.includes(s.format)) && acDur(s)],
    [["format"], base, (s) => s.durations.includes(params.budget_min) && acDur(s)],
    [["format", "duration\xB15"], base, (s) => s.durations.some(near) && acDur(s)],
    [["format", "skeleton"], all, (s) => s.durations.includes(params.budget_min) && acDur(s)],
    [["format", "skeleton", "duration\xB15"], all, (s) => s.durations.some(near) && acDur(s)]
  ];
  const tiers = [];
  for (const [relaxations, pool, keep] of steps) {
    const list = pool.filter(keep);
    const key = list.map((x) => x.id).join(",");
    if (list.length && !tiers.some((t) => t.list.map((x) => x.id).join(",") === key)) tiers.push({ list, relaxations });
  }
  return tiers;
}
var TIER_ATTEMPTS = 50;
function pickUnit(slot2, m) {
  const want = slot2.pick.unit ?? (m.family === "erg" ? slot2.pick.erg_unit : void 0);
  if (want) return m.units_allowed.includes(want) ? want : null;
  return m.unit_default;
}
function matchesPick(ctx, slot2, m, picked, sk, functionalSmall) {
  const p = slot2.pick;
  const format = sk.format;
  if (!m.active) return "inactive";
  if (RACK_ONLY_IDS.has(m.id) && !rackAllowed(sk)) return "rack_format";
  if (weightFor(m, ctx.params.discipline) <= 0) return "zero_weight";
  if (ctx.subOnly.has(m.id)) return "substitution_only";
  if (p.ids && !p.ids.includes(m.id)) return "ids";
  if (p.family && !p.family.includes(m.family)) return "family";
  if (p.modality && !p.modality.includes(m.modality)) return "modality";
  if (p.pattern_any && !m.pattern.some((x) => p.pattern_any.includes(x))) return "pattern_any";
  if (p.pattern_not && m.pattern.some((x) => p.pattern_not.includes(x))) return "pattern_not";
  if (ctx.params.pattern_not && m.pattern.some((x) => ctx.params.pattern_not.includes(x))) return "session_pattern_not";
  if (isExcluded(ctx, m)) return "excluded";
  if (equipmentExcluded(ctx, m)) return "equipment_excluded";
  if (ctx.params.intention === "cardio" && isSlowSkill(m)) return "cardio_slow_skill";
  const unit = pickUnit(slot2, m);
  if (unit === null) return "unit";
  if (!m.rep_ranges) return "no_ranges";
  if (ctx.params.intention === "run" && m.family === "run" && slot2.qty === "range" && (m.rep_ranges[unit]?.[RANGE_FORMAT[format]]?.[1] ?? 0) < RUN_MIN_M) return "run_too_short";
  if (ctx.afterClass) {
    const carrier = ctx.afterClass.intentionExempt === true && carriesIntention(ctx.params, m, "light", sk);
    if (!carrier && m.pattern.some((x) => ctx.afterClass.patterns.has(x))) return "after_class_pattern";
    if (!carrier && ctx.afterClass.families.has(m.family)) return "after_class_family";
  }
  if (picked.some((q) => q.m.id === m.id)) return "duplicate";
  if (p.pattern_not_of_slot !== void 0) {
    const other = picked.find((q) => q.index === p.pattern_not_of_slot);
    if (other && primaryPattern(other.m) === primaryPattern(m)) return "pattern_not_of_slot";
  }
  if (p.no_shared_high_grip_with !== void 0) {
    const other = picked.find((q) => q.index === p.no_shared_high_grip_with);
    if (other && other.m.grip === "high" && m.grip === "high") return "shared_high_grip";
  }
  const prev = picked.length ? picked[picked.length - 1] : void 0;
  if (prev && prev.round === void 0) {
    if (primaryPattern(prev.m) === primaryPattern(m) && primaryPattern(m) !== "mono") return "consecutive_pattern";
    if (prev.m.grip === "high" && m.grip === "high") return "consecutive_grip";
    if ((format === "stations" || format === "emom") && prev.m.shoulder_load === "high" && m.shoulder_load === "high") return "consecutive_shoulder";
    if (prev.m.family === "erg" && m.family === "erg" && (format === "stations" || format === "continuous")) return "consecutive_erg";
  }
  if (functionalSmall && m.family === "barbell" && picked.some((q) => q.m.family === "barbell")) return "second_barbell";
  return null;
}
function drawMovement(ctx, slot2, index, picked, sk, functionalSmall, need) {
  const reasons = {};
  const resolve = (m) => {
    const r = matchesPick(ctx, slot2, m, picked, sk, functionalSmall);
    if (r === null) return m;
    if (r === "equipment_excluded" && EQUIPMENT_FALLBACK[m.id]) {
      const fb = movementById(ctx.catalog, EQUIPMENT_FALLBACK[m.id]);
      if (fb && matchesPick(ctx, slot2, fb, picked, sk, functionalSmall) === null) return fb;
    }
    reasons[r] = (reasons[r] ?? 0) + 1;
    return null;
  };
  const pool = [];
  for (const m of ctx.catalog.movements) {
    const use = resolve(m);
    if (!use) continue;
    if (need && !need(use)) {
      reasons.intention = (reasons.intention ?? 0) + 1;
      continue;
    }
    pool.push({ drawn: m, use });
  }
  const hit = ctx.rng.pickWeighted(pool, (x) => weightFor(x.drawn, ctx.params.discipline));
  if (!hit) throw new Reject(`slot_${index}_empty:${Object.keys(reasons).sort().join(",")}`);
  return hit.use;
}
function stepQty(q, unit) {
  if (unit === "m") return q > 1e3 ? 100 : q > 200 ? 50 : q > 50 ? 10 : 5;
  if (unit === "cal" || unit === "s") return q > 20 ? 5 : 1;
  return 1;
}
function roundQty(q, unit) {
  if (unit === "m") {
    if (q >= 1e3) return Math.round(q / 100) * 100;
    return q >= 200 ? Math.round(q / 50) * 50 : q >= 50 ? Math.round(q / 10) * 10 : Math.round(q / 5) * 5;
  }
  if (unit === "cal" || unit === "s") return q >= 20 ? Math.round(q / 5) * 5 : Math.round(q);
  return Math.max(1, Math.round(q));
}
function rangeFor(ctx, slot2, m, unit, format) {
  let r = slot2.reps_range ?? m.rep_ranges?.[unit]?.[RANGE_FORMAT[format]];
  if (!r) throw new Reject(`no_range:${m.id}:${unit}`);
  if (slot2.qty_max !== void 0 && slot2.qty_max < r[1]) r = [Math.min(r[0], slot2.qty_max), slot2.qty_max];
  if (ctx.params.intention === "run" && m.family === "run" && unit === "m") {
    if (r[1] < RUN_MIN_M) throw new Reject(`run_too_short:${m.id}`);
    r = [Math.max(r[0], RUN_MIN_M), r[1]];
  }
  return r;
}
function drawFixed(ctx, slot2, m, unit) {
  if (slot2.fixed_by_id && slot2.fixed_by_id[m.id] !== void 0) return slot2.fixed_by_id[m.id];
  if (slot2.fixed !== void 0) return slot2.fixed;
  if (slot2.fixed_range) return roundQty(ctx.rng.int(slot2.fixed_range[0], slot2.fixed_range[1]), unit);
  throw new Reject(`fixed_missing:${m.id}`);
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
function activeSlots(ctx, sk, variant) {
  const src = variant ? variant.slots : sk.slots;
  const sc = sk.station_count;
  if (!sc) return src;
  let n;
  if (sc.by_duration && sc.by_duration[ctx.params.budget_min] !== void 0) n = sc.by_duration[ctx.params.budget_min];
  else if (sc.min !== void 0 && sc.max !== void 0) n = ctx.rng.int(sc.min, sc.max);
  else n = src.length;
  const required = src.filter((s) => !s.optional);
  const optional = src.filter((s) => s.optional);
  const chosen = new Set(required);
  for (const o of optional) if (chosen.size < n) chosen.add(o);
  return src.filter((s) => chosen.has(s));
}
function pickRounds(ctx, sk, variant, band) {
  const r = variant?.rounds ?? sk.rounds;
  if (!r || r === "amrap") return [0];
  if (r === "scheme") return [(variant?.scheme ?? sk.scheme_by_band?.[band] ?? sk.scheme ?? []).length];
  const max = Math.min(r.max, sk.max_rounds_by_band?.[band] ?? r.max);
  const list = [];
  for (let i = r.min; i <= max; i++) list.push(i);
  return ctx.rng.shuffle(list);
}
function toGenerated(ctx, d, p) {
  const cats = categoriesFor(ctx.params.discipline);
  const loads = {};
  const subs = {};
  const vars = {};
  const cad = {};
  for (const c of cats) {
    loads[c] = p.m.loads ? loadsFor(p.m, c, p.band) : null;
    const subId = substitutionFor(p.m, c);
    subs[c] = subId && subId !== p.m.id ? movementById(ctx.catalog, subId)?.name ?? null : null;
    const ref = functionalRef(c);
    vars[c] = d.sk.allow_variant_up && p.m.variant_up && isFunctionalCategory(c) && (ref === "elite" || ref === "pro") ? movementById(ctx.catalog, p.m.variant_up)?.name ?? null : null;
    const cd = cadenceFor(p.m, c, p.unit);
    if (cd === void 0) throw new Reject(`no_cadence:${p.m.id}:${p.unit}`);
    cad[c] = cd;
  }
  return {
    id: p.m.id,
    name: p.m.name,
    unit: p.unit,
    qty: p.qty,
    ...p.scheme ? { scheme: p.scheme } : {},
    ...p.round !== void 0 ? { round: p.round } : {},
    ...p.slot.qty === "minute" ? { per_minute: true } : {},
    cadence_by_category: cad,
    load_band: p.m.loads ? p.band : null,
    loads_by_category: loads,
    substitutions_by_category: subs,
    variant_by_category: vars,
    load_unit: p.m.load_unit,
    badge_key: p.m.badge_key
  };
}
function blockOf(ctx, d) {
  return {
    kind: "wod",
    format: d.sk.format,
    rounds: d.rounds,
    timecap: null,
    ...d.scheme ? { scheme: d.scheme } : {},
    ...d.ladder ? { ladder: d.ladder } : {},
    ...d.rest ? { rest: d.rest } : {},
    ...d.stations ? { stations: d.stations } : {},
    movements: d.picked.map((p) => toGenerated(ctx, d, p))
  };
}
function within(est, budget) {
  return Math.abs(est - budget) / budget <= TOLERANCE + 1e-9;
}
function scaleRanges(d, factor) {
  let moved = false;
  for (const p of d.picked) {
    if (!p.range) continue;
    const next = clamp(roundQty(p.qty * factor, p.unit), p.range[0], p.range[1]);
    if (next !== p.qty) {
      p.qty = next;
      moved = true;
    }
  }
  return moved;
}
function refBlock(ctx, d) {
  return blockOf(ctx, d);
}
function fitFixedVolume(ctx, d, roundsCandidates) {
  const budgetS = ctx.params.budget_min * 60;
  for (const rounds of roundsCandidates) {
    d.rounds = rounds > 1 ? rounds : null;
    for (let iter = 0; iter < 4; iter++) {
      const est = fixedWorkSeconds(refBlock(ctx, d), ctx.ref);
      if (within(est / 60, ctx.params.budget_min)) return;
      if (!scaleRanges(d, budgetS / est)) break;
    }
  }
  throw new Reject("duration_fixed");
}
function fitInterval(ctx, d, roundsCandidates) {
  const budgetS = ctx.params.budget_min * 60;
  const rest = d.sk.rest ?? {};
  const variantRest = d.variantId ? d.sk.variants?.find((v) => v.id === d.variantId)?.rest : void 0;
  const r = { ...rest, ...variantRest };
  if (r.every_s !== void 0) {
    const everyList = Array.isArray(r.every_s) ? ctx.rng.shuffle([...r.every_s]) : [r.every_s];
    const frac = d.sk.max_work_fraction ?? 0.65;
    for (const every of everyList) {
      for (const rounds of roundsCandidates) {
        d.rounds = rounds;
        d.rest = { every_s: every };
        const total2 = every * rounds;
        if (total2 > budgetS || !within(total2 / 60, ctx.params.budget_min)) continue;
        const targetWork = every * frac * 0.85;
        for (let iter = 0; iter < 4; iter++) {
          const work = roundSeconds(refBlock(ctx, d), ctx.ref);
          if (work <= every * frac) return;
          if (work > every * frac || iter === 0) {
            if (!scaleRanges(d, targetWork / work)) break;
          } else break;
        }
      }
    }
    throw new Reject("duration_interval");
  }
  const restS = typeof r.rest_s === "number" ? r.rest_s : 60;
  for (const rounds of roundsCandidates) {
    d.rounds = rounds;
    d.rest = { rest_s: restS };
    const work = roundSeconds(refBlock(ctx, d), ctx.ref);
    const total2 = rounds * work + restS * (rounds - 1);
    if (total2 <= budgetS && within(total2 / 60, ctx.params.budget_min)) return;
  }
  throw new Reject("duration_interval_rest");
}
function fitAmrap(ctx, d) {
  const budgetS = ctx.params.budget_min * 60;
  for (let iter = 0; iter < 4; iter++) {
    const rs = roundSeconds(refBlock(ctx, d), ctx.ref);
    const rounds = budgetS / rs;
    if (rounds >= 3 && rounds <= 10) return;
    const target = rounds < 3 ? budgetS / 4 : budgetS / 8;
    if (!scaleRanges(d, target / rs)) break;
  }
  throw new Reject("amrap_round_length");
}
function fitEmom(ctx, d) {
  const every = typeof d.sk.rest?.every_s === "number" ? d.sk.rest.every_s : 60;
  const maxWork = d.sk.max_station_work_s ?? every * 0.65;
  d.rest = { every_s: every };
  d.rounds = Math.floor(ctx.params.budget_min * 60 / every / d.picked.length);
  if (d.rounds < 2) throw new Reject("emom_too_short");
  for (const p of d.picked) {
    const m = toGenerated(ctx, d, p);
    for (let iter = 0; iter < 4; iter++) {
      const work = movementSeconds({ ...m, qty: p.qty }, ctx.ref);
      if (work <= maxWork && work >= maxWork * 0.4) break;
      if (!p.range) {
        if (work > maxWork) throw new Reject("emom_station_too_long");
        break;
      }
      const next = clamp(roundQty(p.qty * (maxWork * 0.8 / work), p.unit), p.range[0], p.range[1]);
      if (next === p.qty) {
        if (work > maxWork) throw new Reject("emom_station_too_long");
        break;
      }
      p.qty = next;
    }
  }
}
function fitStations(ctx, d) {
  const rest = d.sk.rest ?? {};
  const works = Array.isArray(rest.work_s) ? seq(rest.work_s[0], rest.work_s[1], 15) : [rest.work_s ?? 60];
  const rests = Array.isArray(rest.rest_s) ? seq(rest.rest_s[0], rest.rest_s[1], 15) : [rest.rest_s ?? 15];
  const roundsList = pickRounds(ctx, d.sk, null, d.band);
  const n = d.picked.length;
  const combos = [];
  for (const rounds of roundsList) for (const w of works) for (const r of rests) combos.push([rounds, w, r]);
  for (const [rounds, w, r] of ctx.rng.shuffle(combos)) {
    const total2 = rounds * n * (w + r) / 60;
    if (total2 <= ctx.params.budget_min && within(total2, ctx.params.budget_min)) {
      d.rounds = rounds;
      d.rest = { work_s: w, rest_s: r };
      d.stations = n;
      for (const p of d.picked) {
        const cad = cadenceFor(p.m, ctx.ref, p.unit);
        if (!cad) throw new Reject(`no_cadence:${p.m.id}`);
        let q = roundQty(w * 0.9 / cad, p.unit);
        while (q * cad > w && q > 1) q = roundQty(q - stepQty(q, p.unit), p.unit);
        if (q * cad > w) throw new Reject(`station_target:${p.m.id}`);
        p.qty = q;
      }
      return;
    }
  }
  throw new Reject("duration_stations");
}
function seq(a, b, step) {
  const out = [];
  for (let v = a; v <= b; v += step) out.push(v);
  return out;
}
function fitLadder(ctx, d) {
  const base = d.sk.scheme ?? [];
  if (base.length < 2) throw new Reject("ladder_scheme_missing");
  const start = base[0];
  const step = base[1] - base[0];
  d.ladder = { start, step };
  d.rounds = null;
  d.scheme = [start, start + step];
  for (const p of d.picked) {
    p.scheme = d.scheme;
    p.qty = start * 2 + step;
  }
  const budgetS = ctx.params.budget_min * 60;
  const block = refBlock(ctx, d);
  const refStep = ladderStep(block, ctx.ref, budgetS);
  if (refStep < start + 2 * step) throw new Reject("ladder_too_short");
  const cats = categoriesFor(ctx.params.discipline);
  const lo = ladderStep(block, cats[0], budgetS);
  const hi = ladderStep(block, cats[cats.length - 1], budgetS);
  if (lo >= hi) throw new Reject("ladder_same_step_all_categories");
  d.scheme = [];
  for (let q = start; q <= refStep; q += step) d.scheme.push(q);
  const total2 = d.scheme.reduce((s, q) => s + q, 0);
  for (const p of d.picked) {
    p.scheme = d.scheme;
    p.qty = total2;
  }
}
function fitDeathBy(ctx, d) {
  const main2 = d.picked.find((p) => p.slot.qty === "minute");
  if (!main2) throw new Reject("death_by_no_main");
  const cad = cadenceFor(main2.m, ctx.ref, main2.unit) ?? 0;
  const buy = d.picked.filter((p) => p !== main2).reduce((s, p) => s + p.qty * (cadenceFor(p.m, ctx.ref, p.unit) ?? 0) + TRANSITION_S, 0);
  let minute = 0;
  for (let n = 1; n <= ctx.params.budget_min; n++) {
    if (buy + n * cad > 60) break;
    minute = n;
  }
  if (minute < Math.ceil(ctx.params.budget_min * 0.6)) throw new Reject("death_by_too_fast");
  d.rest = { every_s: 60 };
  d.rounds = null;
}
function fitContinuous(ctx, d) {
  const cycle = roundSeconds(refBlock(ctx, d), ctx.ref);
  const budgetS = ctx.params.budget_min * 60;
  if (budgetS / cycle < 1.5) throw new Reject("continuous_cycle_too_long");
  d.rounds = null;
  d.stations = d.picked.length;
}
function fitTabata(ctx, d) {
  const transition = ctx.params.budget_min >= 10 ? 60 : 0;
  d.rest = { work_s: 20, rest_s: 10, transition_s: transition };
  d.rounds = 8;
  const total2 = (2 * 8 * 30 + transition) / 60;
  if (total2 > ctx.params.budget_min || !within(total2, ctx.params.budget_min)) throw new Reject("duration_tabata");
  for (const p of d.picked) p.qty = 0;
}
function lastCarrierSlot(ctx, sk, slots, band) {
  if (!SLOT_INTENTIONS.has(ctx.params.intention)) return -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    const p = slots[i].pick;
    const slotBand = p.band ? constrainBand(p.band, ctx.params, sk) : band;
    const ok = ctx.catalog.movements.some((m) => m.active && weightFor(m, ctx.params.discipline) > 0 && (!p.ids || p.ids.includes(m.id)) && (!p.family || p.family.includes(m.family)) && (!p.modality || p.modality.includes(m.modality)) && (!p.pattern_any || m.pattern.some((x) => p.pattern_any.includes(x))) && (!p.pattern_not || !m.pattern.some((x) => p.pattern_not.includes(x))) && carriesIntention(ctx.params, m, slotBand, sk));
    if (ok) return i;
  }
  return -1;
}
function buildDraft(ctx, sk) {
  const variant = sk.variants && sk.variants.length ? ctx.rng.pick(sk.variants) : null;
  const band = effectiveBand(sk, ctx.params);
  const slots = activeSlots(ctx, sk, variant);
  const format = sk.format;
  const functionalSmall = ctx.params.discipline === "functional" && slots.length <= 3;
  const scheme = variant?.scheme ?? sk.scheme_by_band?.[band] ?? sk.scheme;
  const d = { sk, variantId: variant?.id ?? null, slots, band, picked: [], rounds: null };
  const roundsCandidates = pickRounds(ctx, sk, variant, band);
  const rounds = roundsCandidates[0] || null;
  const intentionMet = () => !SLOT_INTENTIONS.has(ctx.params.intention) || d.picked.some((p) => carriesIntention(ctx.params, p.m, p.band, sk));
  const lastCarrier = lastCarrierSlot(ctx, sk, slots, band);
  slots.forEach((slot2, index) => {
    const slotBand = slot2.pick.band ? constrainBand(slot2.pick.band, ctx.params, sk) : band;
    const need = index === lastCarrier && !intentionMet() ? (m2) => carriesIntention(ctx.params, m2, slotBand, sk) : void 0;
    const m = drawMovement(ctx, slot2, index, d.picked, sk, functionalSmall, need);
    const unit = pickUnit(slot2, m);
    const base = { slot: slot2, index, m, unit, band: slotBand, qty: 0 };
    switch (slot2.qty) {
      case "range": {
        const r = rangeFor(ctx, slot2, m, unit, format);
        base.range = r;
        base.qty = roundQty(ctx.rng.int(r[0], r[1]), unit);
        break;
      }
      case "fixed":
        base.qty = drawFixed(ctx, slot2, m, unit);
        break;
      case "scheme": {
        if (!scheme) throw new Reject("scheme_missing");
        if (format === "chipper") base.qty = scheme[index] ?? scheme[scheme.length - 1];
        else {
          base.scheme = scheme;
          base.qty = scheme.reduce((s, q) => s + q, 0);
        }
        break;
      }
      case "minute":
        base.qty = 1;
        break;
    }
    if (slot2.rotate_per_round && rounds && rounds >= 4) {
      const extra = [];
      base.round = 1;
      for (let r = 2; r <= rounds; r++) {
        const mm = drawMovement(ctx, slot2, index, [...d.picked, base, ...extra], sk, functionalSmall);
        const uu = pickUnit(slot2, mm);
        const q = { slot: slot2, index, m: mm, unit: uu, band: slotBand, qty: 0, round: r };
        if (slot2.qty === "range") {
          q.range = rangeFor(ctx, slot2, mm, uu, format);
          q.qty = roundQty(ctx.rng.int(q.range[0], q.range[1]), uu);
        } else q.qty = drawFixed(ctx, slot2, mm, uu);
        extra.push(q);
      }
      d.picked.push(base, ...extra);
    } else {
      d.picked.push(base);
    }
  });
  if (format !== "chipper" && scheme && !variant?.scheme) d.scheme = scheme;
  if (variant?.scheme) d.scheme = variant.scheme;
  switch (format) {
    case "amrap":
      fitAmrap(ctx, d);
      d.rounds = null;
      break;
    case "emom":
      fitEmom(ctx, d);
      break;
    case "interval":
      fitInterval(ctx, d, roundsCandidates);
      break;
    case "stations":
      fitStations(ctx, d);
      break;
    case "ladder":
      fitLadder(ctx, d);
      break;
    case "death_by":
      fitDeathBy(ctx, d);
      break;
    case "continuous":
      fitContinuous(ctx, d);
      break;
    case "tabata":
      fitTabata(ctx, d);
      break;
    case "rounds_for_time": {
      const rotating = d.picked.some((p) => p.round !== void 0);
      fitFixedVolume(ctx, d, rotating ? [rounds ?? 1] : roundsCandidates);
      break;
    }
    case "chipper":
      fitFixedVolume(ctx, d, [1]);
      d.rounds = null;
      break;
    default:
      fitFixedVolume(ctx, d, d.scheme ? [d.scheme.length] : [0]);
      d.rounds = null;
  }
  applyVolumeCaps(ctx, d);
  checkComposition(ctx, d);
  return d;
}
function checkComposition(ctx, d) {
  const { intention, discipline } = ctx.params;
  if (discipline === "hybrid") {
    if (!d.picked.some((p) => p.m.family === "erg" || p.m.family === "run")) throw new Reject("hybrid_without_erg_or_run");
  } else {
    const has = (mod) => d.picked.some((p) => p.m.modality === mod);
    if (!has("W") && !has("G")) throw new Reject("functional_without_W_or_G");
    if (intention === "cardio" && !has("M")) throw new Reject("intention_without_M");
  }
  if (intention === "cardio" && d.picked.some((p) => isSlowSkill(p.m))) throw new Reject("cardio_slow_skill");
  if (SLOT_INTENTIONS.has(intention) && !d.picked.some((p) => carriesIntention(ctx.params, p.m, p.band, d.sk))) {
    throw new Reject(`intention_${intention}_unmet`);
  }
  if (intention === "engine" && engineShare(ctx.catalog, refBlock(ctx, d), ctx.ref) < ENGINE_MIN_SHARE) throw new Reject("engine_share");
  if (intention === "run" && !d.picked.some((p) => p.m.family === "run" && p.unit === "m" && p.qty >= RUN_MIN_M)) throw new Reject("run_segment_short");
}
function volumeMultiplier(ctx, d, p) {
  if (p.round !== void 0) return 1;
  const budgetS = ctx.params.budget_min * 60;
  switch (d.sk.format) {
    case "rounds_for_time":
    case "interval":
    case "stations":
    case "emom":
      return d.rounds ?? 1;
    case "amrap":
      return Math.ceil(budgetS / roundSeconds(refBlock(ctx, d), ctx.ref));
    case "continuous":
      return Math.ceil(budgetS / roundSeconds(refBlock(ctx, d), ctx.ref));
    case "death_by": {
      const n = deathByMinute(refBlock(ctx, d), ctx.ref, ctx.params.budget_min);
      return p.slot.qty === "minute" ? n * (n + 1) / 2 : n;
    }
    case "tabata":
      return 0;
    default:
      return 1;
  }
}
function movementCapFor(bank, m, band, unit, category) {
  for (const c of bank.movement_caps) {
    if (c.unit !== unit) continue;
    const hit = c.ids ? c.ids.includes(m.id) : c.family === m.family && (!c.band || c.band === band);
    if (hit) return Math.floor(c.rx * VOLUME_CAP_FACTOR[category]);
  }
  return null;
}
function applyVolumeCaps(ctx, d) {
  for (let pass = 0; pass < 4; pass++) if (!capPass(ctx, d)) return;
  if (capPass(ctx, d)) throw new Reject("volume_cap_unstable");
}
function capPass(ctx, d) {
  const caps = ctx.bank.volume_caps[ctx.params.discipline][ctx.ref] ?? {};
  const tabata = d.sk.format === "tabata";
  let changed = false;
  for (const p of d.picked) {
    const mult = volumeMultiplier(ctx, d, p);
    const perWod = tabata ? 16 * 20 / (cadenceFor(p.m, ctx.ref, p.unit) ?? 1) : p.qty * mult;
    const generic = caps[p.unit];
    const specific = movementCapFor(ctx.bank, p.m, p.band, p.unit, ctx.ref);
    const cap = Math.min(generic ?? Infinity, specific ?? Infinity);
    if (cap === Infinity || perWod <= cap) continue;
    if (!p.range || mult <= 0 || tabata) throw new Reject(`volume_cap:${p.m.id}`);
    const next = roundQty(Math.floor(cap / mult), p.unit);
    if (next < p.range[0] || next >= p.qty) throw new Reject(`volume_cap:${p.m.id}`);
    p.qty = next;
    changed = true;
  }
  return changed;
}
function finalize(ctx, d, tierRelaxations, attempts, seed) {
  const block = blockOf(ctx, d);
  const ac = ctx.afterClass;
  const relaxations = ac?.intentionExempt && d.picked.some((p) => p.m.pattern.some((x) => ac.patterns.has(x)) || ac.families.has(p.m.family)) ? [...tierRelaxations, "after_class_pattern"] : tierRelaxations;
  const refEst = estimateBlock(block, ctx.ref, ctx.params.budget_min);
  if (!TIME_BOUNDED.has(d.sk.format) && !within(refEst.minutes, ctx.params.budget_min)) throw new Reject("duration_final");
  if (d.sk.format === "amrap") {
    const rounds = ctx.params.budget_min * 60 / roundSeconds(block, ctx.ref);
    if (rounds < 3 || rounds > 10) throw new Reject("amrap_round_length");
  }
  const timeBounded = TIME_BOUNDED.has(d.sk.format) || d.sk.format === "interval" || d.sk.score_type !== "time";
  block.timecap = timeBounded ? null : Math.ceil(refEst.minutes * d.sk.cap_factor / 0.5) * 30;
  const vest = ctx.params.discipline === "hybrid" && ctx.params.vest && ctx.params.vest !== "none" ? { mode: ctx.params.vest, load_kg_by_category: pickCats(ctx) } : null;
  const partial = {
    source: "generator",
    generator: {
      version: ENGINE_VERSION,
      skeleton_id: d.sk.id + (d.variantId ? `:${d.variantId}` : ""),
      seed,
      catalog_version: ctx.catalog.version,
      bank_version: ctx.bank.version,
      relaxations,
      attempts
    },
    discipline: ctx.params.discipline,
    entry: ctx.params.entry,
    intention: ctx.params.intention,
    format: d.sk.format,
    budget_min: ctx.params.budget_min,
    vest,
    blocks: [block],
    stimulus: { ...d.sk.stimulus },
    score_type: d.sk.score_type,
    after_class: ctx.afterClass ? { excluded_patterns: [...ctx.afterClass.patterns].sort(), excluded_families: [...ctx.afterClass.families].sort() } : null
  };
  const estimate = estimateAll({ ...partial, ...emptyEditor() });
  const wod = { ...emptyEditor(), ...partial, estimate, signature: "" };
  wod.signature = signature(wod);
  return render(wod);
}
function pickCats(ctx) {
  const out = {};
  for (const c of categoriesFor(ctx.params.discipline)) out[c] = VEST_LOAD_KG[c];
  return out;
}
function emptyEditor() {
  return {
    title: "",
    description: "",
    wod_type: "custom",
    block_name: "wod",
    time_cap_seconds: null,
    rounds: null,
    notes: null,
    video_url: null,
    leaderboard_enabled: true,
    emom_interval_minutes: null,
    tabata_work_seconds: null,
    tabata_rest_seconds: null
  };
}
function generateBlocC(params, catalog, bank, seed) {
  const rng = new RNG(seed);
  const ref = params.profile_category ?? referenceCategory({ discipline: params.discipline });
  const refOk = categoriesFor(params.discipline).includes(ref);
  const ctx = {
    params,
    catalog,
    bank,
    rng,
    ref: refOk ? ref : referenceCategory({ discipline: params.discipline }),
    exclude: new Set((params.exclude ?? []).map(norm)),
    afterClass: params.entry === "after_class" && params.after_class ? afterClassFilter(catalog, params.after_class.day_movements) : null,
    subOnly: substitutionOnlyIds(catalog, params.discipline)
  };
  if (ctx.afterClass && SLOT_INTENTIONS.has(params.intention)) {
    const probe = { id: "probe", format: "emom" };
    const reachable = catalog.movements.some((m) => m.active && weightFor(m, params.discipline) > 0 && !ctx.subOnly.has(m.id) && carriesIntention(params, m, "light", probe) && !equipmentExcluded(ctx, m) && !m.pattern.some((x) => ctx.afterClass.patterns.has(x)) && !ctx.afterClass.families.has(m.family));
    if (!reachable) ctx.afterClass.intentionExempt = true;
  }
  const tiers = candidateTiers(params, bank);
  if (!tiers.length) throw new NoValidWod("Aucun squelette compatible", { no_skeleton: 1 });
  const recent = new Set(params.recent_signatures ?? []);
  const reasons = {};
  let tier = 0;
  let tierFails = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (tierFails >= TIER_ATTEMPTS && tier < tiers.length - 1) {
      tier++;
      tierFails = 0;
    }
    const { list, relaxations } = tiers[tier];
    const sk = rng.pick(list);
    try {
      const d = buildDraft(ctx, sk);
      const wod = finalize(ctx, d, relaxations, attempt, seed);
      if (recent.has(wod.signature)) throw new Reject("recent_signature");
      return wod;
    } catch (e) {
      if (e instanceof Reject) {
        tierFails++;
        reasons[`${sk.id}:${e.reason}`] = (reasons[`${sk.id}:${e.reason}`] ?? 0) + 1;
        continue;
      }
      throw e;
    }
  }
  throw new NoValidWod(`Aucun WOD valide apr\xE8s ${MAX_ATTEMPTS} tirages`, reasons);
}

// packages/wod-engine/src/profile.ts
function profileCategory(discipline, level, gender) {
  const lv = (level ?? "").toLowerCase().replace(/\s+/g, "");
  if (discipline === "functional") {
    const map = {
      scaled: "scaled",
      inter: "inter",
      intermediate: "inter",
      rx: "rx",
      "rx+": "rxplus",
      rxplus: "rxplus",
      elite: "elite",
      pro: "pro"
    };
    return map[lv] ?? "rx";
  }
  const pro = lv === "pro" || lv === "rx+" || lv === "rxplus" || lv === "elite" || lv.endsWith("pro");
  const women = gender === "female" || lv.startsWith("women");
  if (women) return pro ? "women_pro" : "women";
  return pro ? "men_pro" : "men";
}

// packages/wod-engine/src/muscu.ts
var MUSCU_ENGINE_VERSION = "1.0.0";
var MUSCU_MAX_ATTEMPTS = 40;
var MUSCU_TOLERANCE = 0.1;
var MUSCU_DURATIONS = { express: [20, 30, 45, 60], after_class: [15, 20, 30] };
var BEGINNER_MAX_EXERCISES = 4;
var VOLUME_CAP_SETS = { hypertrophie: 12, force: 10, endurance: 9 };
var WEIGHTED_IDS = ["dips", "strict_pull_up", "chin_up", "wide_grip_pull_up", "neutral_grip_pull_up", "close_grip_pull_up", "close_grip_dips"];
var UNIT_RANGES = { s: [30, 60], m: [30, 50] };
var LOAD_STEP_KG = 2.5;
var SCHEMES = {
  hypertrophie: { sets: { main: 4, other: 3 }, sets_min: 3, sets_max: 5, rest: { main: 90, other: 75 }, rest_max: 120, rpe: 8, rir: "derni\xE8re s\xE9rie \xE0 1-2 reps de l'\xE9chec" },
  force: { sets: { main: 5, other: 4 }, sets_min: 3, sets_max: 5, rest: { main: 150, other: 120 }, rest_max: 180, rpe: 8, rir: "RIR 2, derni\xE8re s\xE9rie RPE 9" },
  endurance: { sets: { main: 3, other: 3 }, sets_min: 2, sets_max: 5, rest: { main: 40, other: 40 }, rest_max: 75, rpe: 7, rir: "rythme continu, aucune s\xE9rie \xE0 l'\xE9chec" }
};
var PCT_ANCHORS = [[3, 88], [4, 85], [5, 82], [6, 79], [8, 72], [10, 68], [12, 65], [15, 60], [18, 55], [20, 52]];
function percentForReps(reps) {
  if (reps <= PCT_ANCHORS[0][0]) return PCT_ANCHORS[0][1];
  for (let i = 1; i < PCT_ANCHORS.length; i++) {
    const [r0, p0] = PCT_ANCHORS[i - 1];
    const [r1, p1] = PCT_ANCHORS[i];
    if (reps <= r1) return Math.round(p0 + (p1 - p0) * (reps - r0) / (r1 - r0));
  }
  return PCT_ANCHORS[PCT_ANCHORS.length - 1][1];
}
var TARGET_LABEL = {
  fessiers: "Fessiers",
  fessiers_ischios: "Fessiers & ischios",
  bas: "Bas du corps",
  full_body: "Full body",
  tronc: "Tronc",
  haut: "Haut du corps",
  dos: "Dos",
  epaules: "\xC9paules",
  bras: "Bras",
  pecs: "Pectoraux",
  push: "Push",
  pull: "Pull",
  jambes: "Jambes"
};
var OBJECTIVE_LABEL = { hypertrophie: "Hypertrophie", force: "Force", endurance: "Endurance musculaire" };
var EQUIPMENT_LABEL = { none: "Sans mat\xE9riel", box: "Box", gym: "Salle" };
var LEVEL_LABEL = { debutant: "D\xE9butant", inter: "Interm\xE9diaire", avance: "Avanc\xE9" };
var LEVEL_RANK = { debutant: 0, inter: 1, avance: 2 };
function muscuLevelFor(level) {
  const lv = (level ?? "").toLowerCase().replace(/\s+/g, "");
  if (!lv || lv === "scaled" || lv === "debutant" || lv === "d\xE9butant") return "debutant";
  if (lv === "inter" || lv === "intermediate" || lv === "rx" || lv === "men" || lv === "women") return "inter";
  return "avance";
}
var InvalidMuscuParams = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "InvalidMuscuParams";
    this.code = code;
  }
};
var PATTERN_MUSCLES = {
  squat: ["quadriceps", "fessiers"],
  lunge: ["quadriceps", "fessiers"],
  push_v: ["epaules"],
  pull_v: ["dos", "biceps"],
  hinge: ["ischios", "lombaires"],
  push_h: ["pecs", "triceps"],
  pull_h: ["dos"]
};
function afterClassMuscles(catalog, ctx) {
  const set = /* @__PURE__ */ new Set();
  for (const raw of ctx.day_movements) {
    const m = resolveMovement(catalog, raw) ?? resolveMovement(catalog, stripLine2(raw));
    if (!m) continue;
    for (const p of m.pattern) for (const mu of PATTERN_MUSCLES[p] ?? []) set.add(mu);
    if (m.muscu) set.add(m.muscu.muscle_primary);
  }
  const excluded = [...set];
  const free = (t) => TARGET_MUSCLES[t].every((mu) => !set.has(mu));
  const suggested_target = ["haut", "bas", "tronc"].find(free) ?? null;
  return { excluded, suggested_target };
}
function stripLine2(raw) {
  return raw.replace(/^\s*\d+(?:[.,]\d+)?\s*(?:x|×|reps?|cal|m|km|s)?\s*/i, "").replace(/\(.*?\)/g, "").trim();
}
function norm2(s) {
  return nameKey(s).replace(/[\s-]+/g, "_");
}
function equipmentWeight(m, eq) {
  return eq === "none" ? m.muscu.weight_bodyweight : eq === "box" ? m.muscu.weight_box : m.muscu.weight_gym;
}
function isExcluded2(ctx, m) {
  if (ctx.exclude.size === 0) return false;
  if (ctx.exclude.has(norm2(m.id)) || ctx.exclude.has(norm2(m.name))) return true;
  if (ctx.exclude.has(norm2(m.family))) return true;
  return m.equipment.some((e) => ctx.exclude.has(norm2(e)));
}
function levelOk(m, level) {
  if (LEVEL_RANK[m.muscu.level_min] > LEVEL_RANK[level]) return false;
  if (level === "debutant" && m.muscu.unilateral) return false;
  return true;
}
function objectiveFor(m, objective) {
  if (m.muscu.objectives.includes(objective)) return objective;
  if (objective === "force" && !m.muscu.compound && m.muscu.objectives.includes("hypertrophie")) return "hypertrophie";
  return null;
}
function basePool(ctx) {
  const { params } = ctx;
  return ctx.catalog.movements.filter((m) => m.muscu).filter((m) => equipmentWeight(m, params.equipment) > 0 && levelOk(m, params.level) && !isExcluded2(ctx, m) && !ctx.excludedMuscles.has(m.muscu.muscle_primary));
}
var COMPOUND_ROLES = /* @__PURE__ */ new Set(["main_compound", "secondary_compound"]);
function roleOk(m, role) {
  if (role === "core" || role === "calves") return true;
  return COMPOUND_ROLES.has(role) ? m.muscu.compound : !m.muscu.compound;
}
function candidates(ctx, slot2, f, picked, prevMuscle) {
  const used = new Set(picked.map((p) => p.m.id));
  const mainMuscles = new Set(picked.filter((p) => p.role === "main_compound").map((p) => p.m.muscu.muscle_primary));
  const requireUnilateral = f.unilateral && !!slot2.unilateral && ctx.params.level !== "debutant";
  return ctx.pool.filter((m) => {
    if (used.has(m.id)) return false;
    if (!f.muscles.includes(m.muscu.muscle_primary)) return false;
    if (prevMuscle && m.muscu.muscle_primary === prevMuscle) return false;
    if (slot2.exclude_ids?.includes(m.id)) return false;
    if (f.ids && slot2.ids && !slot2.ids.includes(m.id)) return false;
    if (requireUnilateral && !m.muscu.unilateral) return false;
    if (f.role && !roleOk(m, slot2.role)) return false;
    if (f.objective && !objectiveFor(m, ctx.params.objective)) return false;
    if (slot2.role === "main_compound" && ctx.params.objective === "force" && mainMuscles.has(m.muscu.muscle_primary)) return false;
    return true;
  });
}
function pickSlot(ctx, slot2, index, picked, target) {
  const slotMuscles = Array.isArray(slot2.muscle) ? slot2.muscle : [slot2.muscle];
  const prev = picked.length ? picked[picked.length - 1].m.muscu.muscle_primary : null;
  const steps = [
    [null, { ids: true, unilateral: true, role: true, objective: true, muscles: slotMuscles }],
    [slot2.ids ? "slot_ids" : null, { ids: false, unilateral: true, role: true, objective: true, muscles: slotMuscles }],
    [slot2.unilateral ? "slot_unilateral" : null, { ids: false, unilateral: false, role: true, objective: true, muscles: slotMuscles }],
    ["slot_role", { ids: false, unilateral: false, role: false, objective: true, muscles: slotMuscles }],
    ["slot_objective", { ids: false, unilateral: false, role: false, objective: false, muscles: slotMuscles }]
  ];
  if (!slot2.optional) {
    const wider = TARGET_MUSCLES[target].filter((mu) => !slotMuscles.includes(mu) && !ctx.excludedMuscles.has(mu));
    if (wider.length) steps.push(["slot_muscle", { ids: false, unilateral: false, role: true, objective: true, muscles: wider }]);
    if (wider.length) steps.push(["slot_muscle", { ids: false, unilateral: false, role: false, objective: false, muscles: wider }]);
  }
  for (const [i, [relax, f]] of steps.entries()) {
    if (i > 0 && relax === null) continue;
    const list = candidates(ctx, slot2, f, picked, prev);
    if (!list.length) continue;
    const m = ctx.rng.pickWeighted(list, (x) => equipmentWeight(x, ctx.params.equipment));
    if (relax) ctx.relax.add(relax);
    return { m, role: slot2.role, objective: objectiveFor(m, ctx.params.objective) ?? "hypertrophie", optional: !!slot2.optional, slotIndex: index };
  }
  return null;
}
function repRange(m, objective) {
  if (m.muscu.unit !== "reps") return UNIT_RANGES[m.muscu.unit];
  const r = m.muscu.rep_ranges[objective] ?? m.muscu.rep_ranges.hypertrophie ?? Object.values(m.muscu.rep_ranges)[0];
  return r ? [r[0], r[1]] : [8, 12];
}
function lineFor(ctx, p) {
  const scheme = SCHEMES[p.objective];
  const kind = p.role === "main_compound" ? "main" : "other";
  const range = repRange(p.m, p.objective);
  const sets = p.role === "core" || p.role === "calves" ? Math.min(scheme.sets.other, 3) : scheme.sets[kind];
  const rest = p.role === "core" ? Math.min(scheme.rest.other, p.objective === "endurance" ? 30 : 60) : p.role === "calves" ? Math.min(scheme.rest.other, 45) : scheme.rest[kind];
  return { ...p, sets, reps: Math.round((range[0] + range[1]) / 2), range, rest };
}
function sessionSeconds(lines) {
  return lines.reduce((acc, l) => acc + l.m.muscu.setup_s + l.sets * (l.reps * l.m.muscu.seconds_per_rep * (l.m.muscu.unilateral ? 2 : 1) + l.rest), 0);
}
function roundLoad(kg) {
  return Math.round(kg / LOAD_STEP_KG) * LOAD_STEP_KG;
}
function loadFor(ctx, l) {
  const { params } = ctx;
  const mu = l.m.muscu;
  const scheme = SCHEMES[l.objective];
  if (mu.load_mode === "bodyweight") {
    if (params.objective === "force" && params.level !== "debutant" && WEIGHTED_IDS.includes(l.m.id) && l.objective === "force") {
      return { mode: "weighted", rpe: scheme.rpe };
    }
    return { mode: "bodyweight" };
  }
  if (mu.load_mode === "1rm" && mu.rm_reference) {
    const rm = params.one_rep_max?.[mu.rm_reference];
    const percent = percentForReps(l.reps);
    if (params.box_wod && params.level !== "debutant") {
      return { mode: "percent", percent, rpe: scheme.rpe, rm_reference: mu.rm_reference };
    }
    if (rm && rm > 0 && params.level !== "debutant") {
      return { mode: "1rm", kg: roundLoad(rm * (mu.rm_factor ?? 1) * (percent / 100)), percent, rm_reference: mu.rm_reference };
    }
    return { mode: "rpe", rpe: params.level === "debutant" ? 7 : scheme.rpe, rm_reference: mu.rm_reference };
  }
  return { mode: "rpe", rpe: scheme.rpe };
}
function total(lines) {
  return sessionSeconds(lines);
}
function volumeByMuscle(lines) {
  const v = /* @__PURE__ */ new Map();
  for (const l of lines) v.set(l.m.muscu.muscle_primary, (v.get(l.m.muscu.muscle_primary) ?? 0) + l.sets);
  return v;
}
function applyVolumeCaps2(ctx, lines) {
  const cap = VOLUME_CAP_SETS[ctx.params.objective];
  const out = [];
  const v = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const mu = l.m.muscu.muscle_primary;
    const room = cap - (v.get(mu) ?? 0);
    if (room < 2) {
      ctx.relax.add("volume_cap");
      continue;
    }
    if (l.sets > room) {
      l.sets = room;
      ctx.relax.add("volume_cap");
    }
    v.set(mu, (v.get(mu) ?? 0) + l.sets);
    out.push(l);
  }
  return out;
}
function hasAdjacency(lines) {
  return lines.some((l, i) => i > 0 && l.m.muscu.muscle_primary === lines[i - 1].m.muscu.muscle_primary);
}
function withinBudget(ctx, lines) {
  const budget = ctx.params.budget_min * 60;
  const t = total(lines);
  return t >= budget * (1 - MUSCU_TOLERANCE) && t <= budget * (1 + MUSCU_TOLERANCE);
}
function breakAdjacency(ctx, lines) {
  const out = [...lines];
  for (let i = 1; i < out.length; i++) {
    if (out[i].m.muscu.muscle_primary !== out[i - 1].m.muscu.muscle_primary) continue;
    const j = out.findIndex((l, k) => k > i && l.m.muscu.muscle_primary !== out[i - 1].m.muscu.muscle_primary && (k + 1 >= out.length || out[k + 1].m.muscu.muscle_primary !== out[i].m.muscu.muscle_primary) && l.role === out[i].role);
    if (j > 0) {
      [out[i], out[j]] = [out[j], out[i]];
      continue;
    }
    out.splice(i, 1);
    ctx.relax.add("adjacent_muscle");
    i--;
  }
  return out;
}
function bonusExercise(ctx, lines, target) {
  const used = new Set(lines.map((l) => l.m.id));
  const last = lines[lines.length - 1]?.m.muscu.muscle_primary ?? null;
  const cap = VOLUME_CAP_SETS[ctx.params.objective];
  const vol = volumeByMuscle(lines);
  const muscles = TARGET_MUSCLES[target].filter((mu) => !ctx.excludedMuscles.has(mu) && (vol.get(mu) ?? 0) + 3 <= cap);
  const base = ctx.pool.filter((m2) => !used.has(m2.id) && muscles.includes(m2.muscu.muscle_primary) && m2.muscu.muscle_primary !== last && objectiveFor(m2, ctx.params.objective));
  const iso2 = base.filter((m2) => !m2.muscu.compound);
  const m = ctx.rng.pickWeighted(iso2.length ? iso2 : base, (x) => equipmentWeight(x, ctx.params.equipment));
  if (!m) return null;
  const p = { m, role: m.muscu.compound ? "secondary_compound" : "isolation", objective: objectiveFor(m, ctx.params.objective), optional: true, slotIndex: 99 };
  return lineFor(ctx, p);
}
function fitBudget(ctx, input, target) {
  const budget = ctx.params.budget_min * 60;
  const lo = budget * (1 - MUSCU_TOLERANCE);
  const hi = budget * (1 + MUSCU_TOLERANCE);
  const maxEx = ctx.params.level === "debutant" ? BEGINNER_MAX_EXERCISES : Infinity;
  let lines = [...input];
  const dropOptional = () => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].optional) {
      lines.splice(i, 1);
      return true;
    }
    return false;
  };
  while (lines.length > maxEx && (dropOptional() || lines.length > 2 && lines.splice(lines.length - 1, 1).length)) ctx.relax.add("beginner_max");
  while (total(lines) > hi) {
    if (dropOptional()) continue;
    const overReps = lines.filter((l) => l.reps > l.range[0]);
    if (overReps.length) {
      for (const l of overReps) l.reps = l.range[0];
      continue;
    }
    const reducible = lines.filter((l) => l.sets > SCHEMES[l.objective].sets_min).sort((a, b) => b.sets - a.sets);
    if (reducible.length) {
      reducible[0].sets--;
      continue;
    }
    if (lines.length > 2) {
      lines.splice(lines.length - 1, 1);
      ctx.relax.add("slots_dropped");
      continue;
    }
    ctx.relax.add("budget_long");
    break;
  }
  const MAX_EXERCISES = 6;
  let guard = 0;
  while (total(lines) < lo && guard++ < 40) {
    const underReps = lines.filter((l) => l.reps < l.range[1]);
    if (underReps.length) {
      for (const l of underReps) l.reps = Math.min(l.range[1], l.reps + (l.range[1] - l.range[0] >= 4 ? 2 : 1));
      continue;
    }
    if (lines.length < Math.min(maxEx, MAX_EXERCISES)) {
      const bonus = bonusExercise(ctx, lines, target);
      if (bonus) {
        if (total([...lines, bonus]) <= hi) {
          lines.push(bonus);
          ctx.relax.add("bonus_slot");
          continue;
        }
        bonus.reps = bonus.range[0];
        if (total([...lines, bonus]) <= hi) {
          lines.push(bonus);
          ctx.relax.add("bonus_slot");
          continue;
        }
      }
    }
    const cap = VOLUME_CAP_SETS[ctx.params.objective];
    const vol = volumeByMuscle(lines);
    const addable = lines.filter((l) => l.sets < SCHEMES[l.objective].sets_max && (vol.get(l.m.muscu.muscle_primary) ?? 0) < cap).sort((a, b) => a.sets - b.sets || a.slotIndex - b.slotIndex);
    const fits = (l) => {
      l.sets++;
      if (total(lines) <= hi) return true;
      l.sets--;
      return false;
    };
    if (addable.some(fits)) continue;
    const restable = lines.filter((l) => l.role !== "core" && l.role !== "calves" && l.rest < SCHEMES[l.objective].rest_max);
    if (restable.length) {
      const before = restable.map((l) => l.rest);
      for (const l of restable) l.rest = Math.min(SCHEMES[l.objective].rest_max, l.rest + 15);
      if (total(lines) <= hi) {
        ctx.relax.add("rest_extended");
        continue;
      }
      restable.forEach((l, i) => {
        l.rest = before[i];
      });
    }
    ctx.relax.add("budget_short");
    break;
  }
  return lines;
}
var SIDE_LABEL = {
  quadriceps: "jambe",
  ischios: "jambe",
  fessiers: "jambe",
  mollets: "jambe",
  biceps: "bras",
  triceps: "bras",
  epaules: "bras",
  epaules_post: "bras",
  epaules_ant: "bras",
  dos: "bras",
  pecs: "bras",
  avant_bras: "bras",
  coiffe: "bras"
};
function sideLabel(m) {
  return SIDE_LABEL[m.muscle_primary] ?? "c\xF4t\xE9";
}
function notesFor(ctx, l, load) {
  const parts = [];
  if (ctx.params.objective === "force" && l.objective !== "force") parts.push("sch\xE9ma hypertrophie");
  if (load.mode === "rpe" && load.rm_reference && ctx.params.level === "debutant") parts.push("monter jusqu'\xE0 une charge propre");
  if (load.mode === "bodyweight" && ctx.params.level === "debutant" && /pull_up|chin_up/.test(l.m.id)) parts.push("D\xE9butant : banded");
  if (load.mode === "bodyweight" && ctx.params.equipment === "none" && ctx.params.objective === "hypertrophie" && l.m.muscu.unit === "reps" && l.m.muscu.compound) parts.push("tempo 3-1-1");
  return parts.join(" \xB7 ");
}
function toExercise(ctx, l) {
  const load = loadFor(ctx, l);
  return {
    id: l.m.id,
    name: l.m.name,
    role: l.role,
    muscle_primary: l.m.muscu.muscle_primary,
    sets: l.sets,
    reps: l.reps,
    reps_unit: l.m.muscu.unit,
    per_side: l.m.muscu.unilateral,
    load,
    rest_s: l.rest,
    notes: notesFor(ctx, l, load),
    badge_key: l.m.badge_key
  };
}
function muscuSignature(skeletonId, exercises) {
  return `musculation|${skeletonId}|${exercises.map((e) => e.id).join(",")}`;
}
function buildOnce(ctx, sk) {
  const picked = [];
  sk.slots.forEach((slot2, i) => {
    const slotMuscles = Array.isArray(slot2.muscle) ? slot2.muscle : [slot2.muscle];
    if (slotMuscles.every((mu) => ctx.excludedMuscles.has(mu)) && slot2.optional) return;
    const p = pickSlot(ctx, slot2, i, picked, sk.target);
    if (p) picked.push(p);
    else ctx.relax.add(slot2.optional ? "optional_slot_empty" : "slot_dropped");
  });
  let lines = picked.map((p) => lineFor(ctx, p));
  lines = breakAdjacency(ctx, lines);
  lines = applyVolumeCaps2(ctx, lines);
  for (let pass = 0; pass < 3; pass++) {
    ctx.relax.delete("budget_short");
    ctx.relax.delete("budget_long");
    lines = breakAdjacency(ctx, fitBudget(ctx, lines, sk.target));
    if (hasAdjacency(lines) === false && withinBudget(ctx, lines)) break;
  }
  return lines;
}
function findSkeleton(bank, target, objective) {
  const list = bank.muscu_skeletons?.length ? bank.muscu_skeletons : MUSCU_SKELETONS;
  const sk = list.find((s) => s.target === target && s.objective === objective) ?? MUSCU_SKELETONS.find((s) => s.target === target && s.objective === objective);
  if (!sk) throw new InvalidMuscuParams("unknown_target", `Aucun squelette ${target} \xD7 ${objective}`);
  return sk;
}
function targetAvailable(catalog, target, equipment, level) {
  const muscles = TARGET_MUSCLES[target];
  const list = catalog.movements.filter((m) => m.muscu).filter((m) => equipmentWeight(m, equipment) > 0 && levelOk(m, level) && muscles.includes(m.muscu.muscle_primary));
  return list.length >= 3 && new Set(list.map((m) => m.muscu.muscle_primary)).size >= 2;
}
function availableTargets(catalog, equipment, level) {
  return MUSCU_TARGETS.filter((t) => targetAvailable(catalog, t, equipment, level));
}
function generateMuscu(params, catalog, bank, seed) {
  if (params.objective === "force" && params.entry === "after_class") {
    throw new InvalidMuscuParams("force_after_class", "Apr\xE8s ma classe : la Force n'est pas propos\xE9e (hypertrophie ou endurance)");
  }
  if (params.objective === "force" && params.equipment === "none") {
    throw new InvalidMuscuParams("force_without_equipment", "Sans mat\xE9riel : la Force est indisponible");
  }
  const sk = findSkeleton(bank, params.target, params.objective);
  const ac = params.entry === "after_class" && params.after_class ? afterClassMuscles(catalog, params.after_class) : null;
  const recent = new Set(params.recent_signatures ?? []);
  if (!targetAvailable(catalog, params.target, params.equipment, params.level)) {
    throw new InvalidMuscuParams("target_unavailable", `${TARGET_LABEL[params.target]} : aucun exercice ${EQUIPMENT_LABEL[params.equipment].toLowerCase()} pour ce niveau`);
  }
  let best = null;
  for (let attempt = 0; attempt < MUSCU_MAX_ATTEMPTS; attempt++) {
    const ctx = {
      params,
      catalog,
      scheme: SCHEMES[params.objective],
      rng: new RNG(seed + attempt * 7919),
      exclude: new Set((params.exclude ?? []).map(norm2)),
      excludedMuscles: new Set(ac?.excluded ?? []),
      relax: /* @__PURE__ */ new Set(),
      pool: []
    };
    ctx.pool = basePool(ctx);
    const lines = buildOnce(ctx, sk);
    if (!lines.length) continue;
    const sig2 = muscuSignature(sk.id, lines.map((l) => ({ id: l.m.id })));
    const cand = { lines, relax: ctx.relax, attempts: attempt + 1 };
    if (!recent.has(sig2)) {
      best = cand;
      break;
    }
    if (!best) best = cand;
    best = { ...best, attempts: attempt + 1 };
    if (attempt === MUSCU_MAX_ATTEMPTS - 1) best.relax.add("repeat");
  }
  if (!best) {
    const ctx = {
      params: { ...params, exclude: [] },
      catalog,
      scheme: SCHEMES[params.objective],
      rng: new RNG(seed),
      exclude: /* @__PURE__ */ new Set(),
      excludedMuscles: /* @__PURE__ */ new Set(),
      relax: /* @__PURE__ */ new Set(["pool_empty"]),
      pool: []
    };
    ctx.pool = basePool(ctx);
    best = { lines: buildOnce(ctx, sk), relax: ctx.relax, attempts: MUSCU_MAX_ATTEMPTS };
  }
  const ctxOut = {
    params,
    catalog,
    scheme: SCHEMES[params.objective],
    rng: new RNG(seed),
    exclude: /* @__PURE__ */ new Set(),
    excludedMuscles: new Set(ac?.excluded ?? []),
    relax: best.relax,
    pool: []
  };
  const exercises = best.lines.map((l) => toExercise(ctxOut, l));
  const seconds = total(best.lines);
  const sig = muscuSignature(sk.id, exercises);
  const stimulus = stimulusFor(params, exercises);
  const wod = {
    source: "generator",
    generator: {
      version: MUSCU_ENGINE_VERSION,
      skeleton_id: sk.id,
      seed,
      catalog_version: catalog.version,
      bank_version: bank.version,
      relaxations: [...best.relax].sort(),
      attempts: best.attempts
    },
    discipline: "musculation",
    entry: params.entry,
    target: params.target,
    objective: params.objective,
    equipment: params.equipment,
    level: params.level,
    budget_min: params.budget_min,
    blocks: [{ kind: "strength_session", exercises }],
    estimate: { minutes: Math.round(seconds / 60), seconds },
    stimulus,
    score_type: "tonnage",
    after_class: ac ? { excluded_muscles: ac.excluded, suggested_target: ac.suggested_target } : null,
    signature: sig,
    title: `${TARGET_LABEL[params.target]} \xB7 ${OBJECTIVE_LABEL[params.objective]}`,
    description: "",
    wod_type: "strength",
    block_name: "wod",
    time_cap_seconds: null,
    rounds: null,
    notes: stimulus.note,
    video_url: null,
    leaderboard_enabled: false,
    emom_interval_minutes: null,
    tabata_work_seconds: null,
    tabata_rest_seconds: null
  };
  wod.description = renderMuscu(wod);
  return wod;
}
function stimulusFor(params, exercises) {
  const scheme = SCHEMES[params.objective];
  const parts = [scheme.rir.charAt(0).toUpperCase() + scheme.rir.slice(1)];
  if (params.objective === "force") {
    const main2 = exercises.find((e) => e.role === "main_compound");
    if (main2) parts.push(`Mont\xE9e en charge sur ${main2.name} : 5 @ 50 % \xB7 3 @ 65 % \xB7 2 @ 75 % avant les s\xE9ries de travail`);
  }
  if (!params.box_wod && exercises.some((e) => e.load.mode === "rpe" && e.load.rm_reference)) {
    parts.push("Renseigne tes 1RM dans le calculateur pour avoir des charges en kg");
  }
  return { rpe: scheme.rpe, note: parts.join(". ") };
}
function fmtRest(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}
function loadText2(e) {
  const l = e.load;
  switch (l.mode) {
    case "1rm":
      return `${l.kg} kg (${l.percent} %)`;
    case "percent":
      return `${l.percent} % 1RM`;
    case "weighted":
      return `lest\xE9e, RPE ${l.rpe}`;
    case "bodyweight":
      return e.reps_unit === "reps" ? "poids du corps" : "\u2014";
    default:
      return `RPE ${l.rpe}`;
  }
}
function exerciseLine(e) {
  let out = `${e.name} \u2014 ${e.sets} \xD7 ${e.reps}`;
  if (e.reps_unit !== "reps") out += ` ${e.reps_unit}`;
  if (e.per_side) out += ` / ${sideLabel(e)}`;
  const l = e.load;
  if (l.mode === "1rm" && l.kg) {
    out += ` @ ${l.kg} kg \u2014 charge ${l.percent} % 1RM`;
  } else if (l.mode === "percent") {
    out += ` @ ${l.percent} %1RM \u2014 charge sans 1RM connu : RPE ${l.rpe}`;
  } else if (l.mode === "weighted") {
    out += ` \u2014 charge lest\xE9e, RPE ${l.rpe}`;
  } else if (l.mode === "rpe") {
    out += ` \u2014 charge RPE ${l.rpe}`;
  } else if (e.reps_unit === "reps") {
    out += " \u2014 charge poids du corps";
  }
  if (e.rest_s > 0) out += ` \u2014 repos ${fmtRest(e.rest_s)}`;
  return out;
}
function renderMuscu(wod) {
  const lines = [];
  lines.push(`Musculation \xB7 ${TARGET_LABEL[wod.target]} \xB7 ${OBJECTIVE_LABEL[wod.objective]} \xB7 ${wod.budget_min}' \xB7 ${EQUIPMENT_LABEL[wod.equipment]}`);
  lines.push("");
  for (const e of wod.blocks[0].exercises) {
    lines.push(exerciseLine(e));
    if (e.notes) lines.push(`  ${e.notes}`);
  }
  lines.push("");
  lines.push(`Dur\xE9e estim\xE9e ${wod.estimate.minutes}'`);
  lines.push(`Stimulus : ${wod.stimulus.note}`);
  if (wod.after_class?.excluded_muscles.length) {
    lines.push(`Apr\xE8s ma classe : muscles \xE9vit\xE9s ${wod.after_class.excluded_muscles.join(", ")}`);
  }
  return lines.join("\n");
}

// packages/wod-engine/src/session.ts
var SESSION_ENGINE_VERSION = "1.0.0";
var SESSION_TOLERANCE = 0.1;
var TRANSITION_MIN = 1;
var WEEKLY_GYM_CAPS = { pull: 150, hspu: 80 };
var WEEKLY_PULL_IDS = /* @__PURE__ */ new Set(["chest_to_bar", "pull_up", "toes_to_bar"]);
var WEEKLY_HSPU_IDS = /* @__PURE__ */ new Set(["handstand_push_up", "strict_handstand_push_up"]);
var MUSCU_WEEKLY_CAP_SETS = 16;
var MUSCU_WEEK_DAYS = [
  { day: 1, target: "push", budget_min: 45 },
  { day: 2, target: "jambes", budget_min: 45 },
  { day: 4, target: "pull", budget_min: 45 },
  { day: 5, target: "fessiers_ischios", budget_min: 45 },
  { day: 6, target: "tronc", budget_min: 20 }
];
var MUSCU_OBJECTIVE_CYCLE = ["hypertrophie", "endurance", "force"];
var DAY_LABEL = { 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi" };
function hashSeed(...parts) {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { iso_year: d.getUTCFullYear(), iso_week: Math.ceil(((d.getTime() - y0) / 864e5 + 1) / 7) };
}
function isoWeekMonday(iso_year, iso_week) {
  const jan4 = new Date(Date.UTC(iso_year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (dow - 1) * 864e5);
  monday.setUTCDate(monday.getUTCDate() + (iso_week - 1) * 7);
  return monday;
}
function muscuObjectiveForWeek(iso_week) {
  return MUSCU_OBJECTIVE_CYCLE[Math.floor((iso_week - 1) / 2) % MUSCU_OBJECTIVE_CYCLE.length];
}
function fmtRest2(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}
function fmtEvery(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}'${String(r).padStart(2, "0")}` : `${m}'`;
}
function nameOf(catalog, id) {
  return movementById(catalog, id)?.name ?? id;
}
function stepLine(name, st, tempo) {
  let out = `${name} \u2014 ${st.sets} \xD7 ${st.reps}`;
  if (st.percent !== null) out += ` @ ${st.percent} %1RM`;
  out += ` \u2014 repos ${fmtRest2(st.rest_s)}`;
  if (tempo && !st.note?.startsWith("mont\xE9e")) out += ` \u2014 tempo ${tempo}`;
  if (st.note) out += ` \u2014 charge ${st.note}`;
  return out;
}
var CAT_LABEL = { scaled: "Scaled", inter: "Inter", rx: "RX", rxplus: "RX+", elite: "Elite", pro: "Pro" };
function blockALines(catalog, opt, weeks) {
  const name = nameOf(catalog, opt.movement);
  const lines = [];
  if (opt.kind === "weightlifting") {
    const complex = (opt.complex ?? []).map((id) => nameOf(catalog, id));
    lines.push(`Halt\xE9ro \u2014 complexe ${name} (${weeks === "even" ? "A" : "B"}) : ${complex.join(" + ")}`);
    lines.push("Un complexe = une r\xE9p\xE9tition, sans l\xE2cher la barre. Sans 1RM connu : monter jusqu'\xE0 une charge propre.");
    for (const st of opt.steps ?? []) lines.push(stepLine(name, st));
  } else if (opt.kind === "strength") {
    lines.push(`Force \u2014 ${name}`);
    for (const st of opt.steps ?? []) lines.push(stepLine(name, st, opt.tempo));
    if (opt.tempo) lines.push(`Tempo ${opt.tempo} sur les s\xE9ries de travail. Sans 1RM connu : derni\xE8re s\xE9rie RPE 8.`);
  } else if (opt.skill) {
    const sk = opt.skill;
    lines.push(`Skill \u2014 ${name} : progression en 3 \xE9tapes`);
    lines.push(`\xC9tape A : positions et tension (hollow / arch, scap, kip) \u2014 ${fmtEvery(180)}`);
    lines.push(`\xC9tape B : la r\xE9p\xE9tition partielle ou assist\xE9e \u2014 ${fmtEvery(180)}`);
    lines.push(`\xC9tape C : Every ${fmtEvery(sk.every_s)} \xD7 ${sk.rounds}`);
    lines.push(`${sk.reps} ${name}`);
    const subs = Object.entries(sk.substitutions).map(([c, s]) => `${CAT_LABEL[c] ?? c} : ${s}`);
    if (subs.length) lines.push(`\u2192 ${subs.join(" \xB7 ")}`);
  }
  return lines;
}
function blockBLines(catalog, opt) {
  const name = nameOf(catalog, opt.movement);
  const lines = [`Building \u2014 ${name} tempo ${opt.tempo ?? ""}`.trim()];
  for (const st of opt.steps) lines.push(stepLine(name, st, opt.tempo));
  return lines;
}
function finisherLines(catalog, opt) {
  const lines = [`Finisher \u2014 ${opt.rounds} rounds, rythme continu :`];
  for (const m of opt.movements) {
    const name = nameOf(catalog, m.id);
    lines.push(m.unit === "s" ? `${m.qty} s ${name}` : m.unit === "m" ? `${m.qty} m ${name}` : `${m.qty} ${name}`);
  }
  return lines;
}
function blocCRepsRx(wod) {
  const b = wod.blocks[0];
  const budgetS = wod.budget_min * 60;
  const out = {};
  for (const gm of b.movements) {
    let mult = 1;
    if (gm.round === void 0) {
      switch (b.format) {
        case "rounds_for_time":
        case "interval":
        case "stations":
        case "emom":
          mult = b.rounds ?? 1;
          break;
        case "amrap":
        case "continuous":
          mult = Math.ceil(budgetS / roundSeconds(b, "rx"));
          break;
        case "ladder": {
          const { step } = ladderProgress(b, "rx", budgetS);
          const start = b.ladder?.start ?? gm.qty;
          const inc = b.ladder?.step ?? gm.qty;
          const n = inc > 0 ? Math.max(1, Math.floor((step - start) / inc) + 1) : 1;
          mult = n * (start + (n - 1) * inc / 2) / Math.max(1, gm.qty);
          break;
        }
        case "death_by": {
          const n = deathByMinute(b, "rx", wod.budget_min);
          mult = gm.per_minute ? n * (n + 1) / 2 / Math.max(1, gm.qty) : n;
          break;
        }
        case "tabata":
          mult = 0;
          break;
        default:
          mult = 1;
      }
    }
    out[gm.id] = (out[gm.id] ?? 0) + Math.round(gm.qty * mult);
  }
  return out;
}
function addReps(into, from) {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}
function gymReps(catalog, reps) {
  const out = {};
  for (const [id, n] of Object.entries(reps)) if (movementById(catalog, id)?.family === "gym") out[id] = n;
  return out;
}
function weeklyGymVolume(sessions) {
  let pull = 0;
  let hspu = 0;
  for (const s of sessions) {
    for (const [id, n] of Object.entries(s.gym_reps_rx)) {
      if (WEEKLY_PULL_IDS.has(id)) pull += n;
      if (WEEKLY_HSPU_IDS.has(id)) hspu += n;
    }
  }
  return { pull, hspu };
}
var InvalidSessionParams = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
function skeletonForDay(bank, day) {
  const sk = bank.session_skeletons.find((s) => s.day === day);
  if (!sk) throw new InvalidSessionParams("no_skeleton", `Aucun squelette de s\xE9ance pour le jour ${day}`);
  return sk;
}
function heavyPatternOf(m) {
  if (!m) return null;
  const p = primaryPattern(m);
  return p ?? null;
}
function editor(title, description, wod_type, block_name, sort_order, minutes, wod_json, notes) {
  return {
    title,
    description,
    wod_type,
    block_name,
    sort_order,
    minutes,
    wod_json,
    notes,
    time_cap_seconds: null,
    rounds: null,
    video_url: null,
    leaderboard_enabled: false,
    emom_interval_minutes: null,
    tabata_work_seconds: null,
    tabata_rest_seconds: null
  };
}
function structured(kind, option_id, extra) {
  return {
    source: "generator",
    discipline: "session",
    kind,
    option_id,
    movement: null,
    heavy_pattern: null,
    steps: null,
    complex: null,
    skill: null,
    finisher: null,
    gym_reps_rx: {},
    ...extra
  };
}
function generateSession(params, catalog, bank, seed) {
  const sk = skeletonForDay(bank, params.day);
  const rng = new RNG(seed);
  const weeks = params.iso_week % 2 === 0 ? "even" : "odd";
  const relax = /* @__PURE__ */ new Set();
  let optA = null;
  if (sk.block_a) {
    const eligible = sk.block_a.filter((o) => !o.weeks || o.weeks === weeks);
    optA = rng.pick(eligible.length ? eligible : sk.block_a);
  }
  const movA = optA ? movementById(catalog, optA.movement) : void 0;
  const heavy = optA && optA.kind !== "skill" ? heavyPatternOf(movA) : null;
  const optB = sk.block_b ? rng.pick(sk.block_b) : null;
  const optF = sk.finisher ? rng.pick(sk.finisher) : null;
  const fixed = sk.warmup.minutes + (optA?.minutes ?? 0);
  const lo = sk.budget_min * (1 - SESSION_TOLERANCE);
  const hi = sk.budget_min * (1 + SESSION_TOLERANCE);
  const combos = [];
  for (const c of sk.block_c.durations) for (const b of [true, false]) for (const f of [true, false]) {
    if (b && !optB) continue;
    if (f && !optF) continue;
    combos.push({ c, b, f });
  }
  const totalOf = (x) => {
    const blocks2 = 1 + (optA ? 1 : 0) + (x.b ? 1 : 0) + (x.f ? 1 : 0);
    return fixed + x.c + (x.b ? optB.minutes : 0) + (x.f ? optF.minutes : 0) + TRANSITION_MIN * blocks2;
  };
  const fitting = combos.filter((x) => totalOf(x) >= lo && totalOf(x) <= hi);
  const pool = fitting.length ? fitting : combos.sort((a, b) => Math.abs(totalOf(a) - sk.budget_min) - Math.abs(totalOf(b) - sk.budget_min)).slice(0, 1);
  if (!fitting.length) relax.add("session_budget");
  const rank = (x) => (x.b ? 2 : 0) + (x.f ? 1 : 0);
  const bestRank = Math.max(...pool.map(rank));
  let choice = rng.pick(pool.filter((x) => rank(x) === bestRank));
  const patternNot = [
    ...sk.block_c.pattern_not === "heavy_pattern" ? heavy ? [heavy] : [] : sk.block_c.pattern_not,
    ...params.pattern_not ?? []
  ];
  const intention = rng.pick(sk.block_c.intentions);
  const format = sk.block_c.formats ? rng.pick(sk.block_c.formats) : void 0;
  const cSeed = seed + 104729 * params.day >>> 0;
  const exclude = [...sk.block_c.exclude ?? [], ...params.exclude ?? []];
  const neighbours = [params.previous_c_skeleton, params.next_c_skeleton].filter((s) => !!s);
  const skeletonNot = neighbours.length ? neighbours : void 0;
  const attempts = [
    { tag: null, c: choice.c, intention, format, patternNot }
  ];
  attempts.push({ tag: "c_fallback:reseed", c: choice.c, intention, format, patternNot });
  if (format) attempts.push({ tag: "c_fallback:format", c: choice.c, intention, format: void 0, patternNot });
  for (const c of sk.block_c.durations) if (c !== choice.c) attempts.push({ tag: "c_fallback:duration", c, intention, format, patternNot });
  if (format) {
    for (const c of sk.block_c.durations) if (c !== choice.c) attempts.push({ tag: "c_fallback:duration", c, intention, format: void 0, patternNot });
  }
  for (const i of sk.block_c.intentions) if (i !== intention) attempts.push({ tag: "c_fallback:intention", c: choice.c, intention: i, format: void 0, patternNot });
  if (patternNot.length) attempts.push({ tag: "c_fallback:pattern", c: choice.c, intention, format: void 0, patternNot: [] });
  let blocC = null;
  let lastErr = null;
  for (const [idx, a] of attempts.entries()) {
    try {
      blocC = generateBlocC({
        entry: "express",
        discipline: "functional",
        budget_min: a.c,
        intention: a.intention,
        format: a.format,
        exclude,
        recent_signatures: params.recent_signatures ?? [],
        pattern_not: a.patternNot.length ? a.patternNot : void 0,
        skeleton_not: skeletonNot
      }, catalog, bank, idx === 0 ? cSeed : hashSeed(cSeed, a.tag ?? "", idx));
      if (a.tag) relax.add(a.tag);
      if (a.c !== choice.c) choice = { ...choice, c: a.c };
      break;
    } catch (e) {
      if (!(e instanceof NoValidWod)) throw e;
      lastErr = e;
    }
  }
  if (!blocC) throw lastErr;
  for (const r of blocC.generator.relaxations) relax.add(`c:${r}`);
  const blocks = [];
  const gym = {};
  const warm = [...sk.warmup.lines, ""];
  let sort = 0;
  if (optA) {
    const lines = blockALines(catalog, optA, weeks);
    const aReps = {};
    if (optA.skill) aReps[optA.movement] = optA.skill.reps * optA.skill.rounds;
    addReps(gym, gymReps(catalog, aReps));
    const kindLabel = optA.kind === "weightlifting" ? "Halt\xE9ro" : optA.kind === "strength" ? "Force" : "Skill";
    blocks.push(editor(
      `${kindLabel} \xB7 ${nameOf(catalog, optA.movement)}`,
      [...warm, ...lines].join("\n"),
      optA.kind === "skill" ? "custom" : "strength",
      optA.kind === "skill" ? "skill" : "strength",
      sort++,
      sk.warmup.minutes + optA.minutes,
      structured(optA.kind, optA.id, {
        movement: optA.movement,
        heavy_pattern: heavy,
        steps: optA.steps ?? null,
        complex: optA.complex ?? null,
        skill: optA.skill ?? null,
        gym_reps_rx: gymReps(catalog, aReps)
      }),
      optA.kind === "weightlifting" ? "Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre." : null
    ));
  }
  if (choice.b && optB) {
    const bReps = {};
    for (const st of optB.steps) bReps[optB.movement] = (bReps[optB.movement] ?? 0) + st.sets * st.reps;
    addReps(gym, gymReps(catalog, bReps));
    blocks.push(editor(
      `Building \xB7 ${nameOf(catalog, optB.movement)}`,
      blockBLines(catalog, optB).join("\n"),
      "strength",
      "building",
      sort++,
      optB.minutes,
      structured("building", optB.id, { movement: optB.movement, steps: optB.steps, gym_reps_rx: gymReps(catalog, bReps) }),
      null
    ));
  }
  const cReps = blocCRepsRx(blocC);
  addReps(gym, gymReps(catalog, cReps));
  const cDescription = optA ? blocC.description : [...warm, blocC.description].join("\n");
  blocks.push({
    title: blocC.title,
    description: cDescription,
    wod_type: blocC.wod_type,
    block_name: "wod",
    sort_order: sort++,
    minutes: choice.c + (optA ? 0 : sk.warmup.minutes),
    wod_json: blocC,
    time_cap_seconds: blocC.time_cap_seconds,
    rounds: blocC.rounds,
    notes: blocC.notes,
    video_url: null,
    leaderboard_enabled: true,
    emom_interval_minutes: blocC.emom_interval_minutes,
    tabata_work_seconds: blocC.tabata_work_seconds,
    tabata_rest_seconds: blocC.tabata_rest_seconds
  });
  if (choice.f && optF) {
    const fReps = {};
    for (const m of optF.movements) if (m.unit === "reps") fReps[m.id] = (fReps[m.id] ?? 0) + m.qty * optF.rounds;
    addReps(gym, gymReps(catalog, fReps));
    blocks.push(editor(
      "Finisher",
      finisherLines(catalog, optF).join("\n"),
      "custom",
      "finisher",
      sort++,
      optF.minutes,
      structured("finisher", optF.id, { finisher: optF, gym_reps_rx: gymReps(catalog, fReps) }),
      null
    ));
  }
  return {
    source: "generator",
    discipline: "session",
    generator: {
      version: SESSION_ENGINE_VERSION,
      skeleton_id: sk.id,
      seed,
      catalog_version: catalog.version,
      bank_version: bank.version,
      relaxations: [...relax].sort()
    },
    day: params.day,
    iso_year: params.iso_year,
    iso_week: params.iso_week,
    label: sk.label,
    budget_min: sk.budget_min,
    total_minutes: totalOf(choice),
    heavy_pattern: heavy,
    blocks,
    bloc_c: blocC,
    gym_reps_rx: gym,
    signature: blocC.signature
  };
}
function generateWeek(params, catalog, bank, seed) {
  const relax = /* @__PURE__ */ new Set();
  const recent = [...params.recent_signatures ?? []];
  const sessions = [];
  const gen = (day, patternNot) => generateSession({
    day,
    iso_year: params.iso_year,
    iso_week: params.iso_week,
    recent_signatures: [...recent, ...sessions.filter((s) => s.day !== day).map((s) => s.signature)],
    previous_c_skeleton: sessions.find((s) => s.day === day - 1)?.bloc_c.generator.skeleton_id ?? null,
    next_c_skeleton: sessions.find((s) => s.day === day + 1)?.bloc_c.generator.skeleton_id ?? null,
    pattern_not: patternNot,
    exclude: params.exclude
  }, catalog, bank, seed + day * 7919 >>> 0);
  for (const day of [1, 2, 3, 4, 5, 6]) sessions.push(gen(day));
  for (const day of [6, 3, 5, 4, 1, 2]) {
    const vol = weeklyGymVolume(sessions);
    if (vol.pull <= WEEKLY_GYM_CAPS.pull && vol.hspu <= WEEKLY_GYM_CAPS.hspu) break;
    const patternNot = [];
    if (vol.pull > WEEKLY_GYM_CAPS.pull) patternNot.push("pull_v");
    if (vol.hspu > WEEKLY_GYM_CAPS.hspu) patternNot.push("push_v");
    const i = sessions.findIndex((s) => s.day === day);
    sessions[i] = gen(day, patternNot);
    relax.add(`weekly_gym_cap:${day}`);
  }
  const gym_volume = weeklyGymVolume(sessions);
  if (gym_volume.pull > WEEKLY_GYM_CAPS.pull || gym_volume.hspu > WEEKLY_GYM_CAPS.hspu) relax.add("weekly_gym_cap_exceeded");
  return { track: "crossfit", iso_year: params.iso_year, iso_week: params.iso_week, seed, sessions, gym_volume, relaxations: [...relax].sort() };
}
function setsByMuscle(days) {
  const v = /* @__PURE__ */ new Map();
  for (const d of days) for (const e of d.wod.blocks[0].exercises) v.set(e.muscle_primary, (v.get(e.muscle_primary) ?? 0) + e.sets);
  return v;
}
function recomputeEstimate(catalog, wod) {
  const lines = wod.blocks[0].exercises.flatMap((e) => {
    const m = movementById(catalog, e.id);
    return m?.muscu ? [{ sets: e.sets, reps: e.reps, rest: e.rest_s, m: { muscu: m.muscu } }] : [];
  });
  const seconds = sessionSeconds(lines);
  wod.estimate = { minutes: Math.round(seconds / 60), seconds };
  wod.description = renderMuscu(wod);
}
function generateMuscuWeek(params, catalog, bank, seed) {
  const objective = muscuObjectiveForWeek(params.iso_week);
  const equipment = params.equipment ?? "box";
  const level = params.level ?? "inter";
  const relax = /* @__PURE__ */ new Set();
  const recent = [...params.recent_signatures ?? []];
  const days = [];
  for (const d of MUSCU_WEEK_DAYS) {
    const wod = generateMuscu({
      entry: "express",
      target: d.target,
      objective,
      budget_min: d.budget_min,
      equipment,
      level,
      exclude: params.exclude,
      recent_signatures: [...recent, ...days.map((x) => x.wod.signature)],
      box_wod: true
    }, catalog, bank, seed + d.day * 7919 >>> 0);
    for (const r of wod.generator.relaxations) relax.add(`${d.target}:${r}`);
    days.push({ day: d.day, target: d.target, budget_min: d.budget_min, wod });
  }
  const minSets = SCHEMES[objective].sets_min;
  const touched = /* @__PURE__ */ new Set();
  for (let guard = 0; guard < 200; guard++) {
    const over = [...setsByMuscle(days).entries()].find(([, n]) => n > MUSCU_WEEKLY_CAP_SETS);
    if (!over) break;
    const [muscle] = over;
    let done = false;
    for (let i = days.length - 1; i >= 0 && !done; i--) {
      const exs = days[i].wod.blocks[0].exercises.filter((e2) => e2.muscle_primary === muscle && e2.sets > minSets);
      const e = exs.sort((a, b) => b.sets - a.sets)[0];
      if (e) {
        e.sets -= 1;
        touched.add(days[i].wod);
        done = true;
      }
    }
    if (!done) {
      for (let i = days.length - 1; i >= 0 && !done; i--) {
        const list = days[i].wod.blocks[0].exercises;
        const j = list.findIndex((e) => e.muscle_primary === muscle && list.length > 3);
        if (j >= 0) {
          list.splice(j, 1);
          touched.add(days[i].wod);
          done = true;
        }
      }
    }
    if (!done) {
      relax.add(`weekly_cap_exceeded:${muscle}`);
      break;
    }
    relax.add(`weekly_cap:${muscle}`);
  }
  for (const wod of touched) {
    wod.generator = { ...wod.generator, relaxations: [.../* @__PURE__ */ new Set([...wod.generator.relaxations, "weekly_cap"])].sort() };
    recomputeEstimate(catalog, wod);
  }
  const sets_by_muscle = {};
  for (const [m, n] of setsByMuscle(days)) sets_by_muscle[m] = n;
  return { track: "musculation", iso_year: params.iso_year, iso_week: params.iso_week, seed, objective, days, sets_by_muscle, relaxations: [...relax].sort() };
}

// packages/wod-engine/src/programming.ts
var TRACKS = ["crossfit", "musculation"];
var TRACK_LABEL = { crossfit: "CrossFit / Hyrox", musculation: "Musculation" };
var TRACK_GROUP_NAME = { crossfit: "CrossFit / Hyrox", musculation: "Musculation" };
var PROGRAMMING_VERSION = SESSION_ENGINE_VERSION;
var REVEAL_HOUR_PARIS = 18;
var RECENT_WEEKS = 4;
function weekDates(iso_year, iso_week) {
  const monday = isoWeekMonday(iso_year, iso_week);
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(monday.getTime() + i * 864e5);
    return d.toISOString().slice(0, 10);
  });
}
function nextIsoWeek(now) {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const local = new Date(Date.UTC(paris.getFullYear(), paris.getMonth(), paris.getDate()));
  return isoWeek(new Date(local.getTime() + 7 * 864e5));
}
function parisOffsetMinutes(utc) {
  const p = new Date(utc.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const u = new Date(utc.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((p.getTime() - u.getTime()) / 6e4);
}
function revealAt(iso_year, iso_week) {
  const monday = isoWeekMonday(iso_year, iso_week);
  const sundayNoonUtc = new Date(monday.getTime() - 864e5 + 12 * 36e5);
  const offset = parisOffsetMinutes(sundayNoonUtc);
  const t = new Date(monday.getTime() - 864e5 + REVEAL_HOUR_PARIS * 36e5 - offset * 6e4);
  return t.toISOString();
}
function weekSeed(box_id, track, iso_year, iso_week, regen_counter) {
  return hashSeed(box_id, track, iso_year, iso_week, regen_counter);
}
function crossfitWeekRows(week, ctx) {
  const dates = weekDates(ctx.iso_year, ctx.iso_week);
  const publish_at = revealAt(ctx.iso_year, ctx.iso_week);
  const rows = [];
  for (const s of week.sessions) {
    for (const b of s.blocks) {
      rows.push({
        box_id: ctx.box_id,
        created_by: ctx.created_by,
        title: b.title,
        description: b.description,
        wod_type: b.wod_type,
        scheduled_date: dates[s.day - 1],
        time_cap_seconds: b.time_cap_seconds,
        rounds: b.rounds,
        notes: b.notes,
        block_name: b.block_name,
        video_url: null,
        leaderboard_enabled: b.block_name === "wod" ? b.leaderboard_enabled : false,
        emom_interval_minutes: b.emom_interval_minutes,
        tabata_work_seconds: b.tabata_work_seconds,
        tabata_rest_seconds: b.tabata_rest_seconds,
        is_published: true,
        publish_at,
        audience: "all",
        sort_order: b.sort_order,
        wod_json: b.wod_json,
        source: "auto",
        auto_run_id: ctx.run_id
      });
    }
  }
  return rows;
}
function muscuWeekRows(week, ctx) {
  const dates = weekDates(ctx.iso_year, ctx.iso_week);
  const publish_at = revealAt(ctx.iso_year, ctx.iso_week);
  return week.days.map((d) => ({
    box_id: ctx.box_id,
    created_by: ctx.created_by,
    title: d.wod.title,
    description: renderMuscu(d.wod),
    wod_type: "strength",
    scheduled_date: dates[d.day - 1],
    time_cap_seconds: null,
    rounds: null,
    notes: d.wod.notes,
    block_name: "strength",
    video_url: null,
    leaderboard_enabled: false,
    emom_interval_minutes: null,
    tabata_work_seconds: null,
    tabata_rest_seconds: null,
    is_published: true,
    publish_at,
    audience: "all",
    sort_order: 0,
    wod_json: d.wod,
    source: "auto",
    auto_run_id: ctx.run_id
  }));
}
async function runWeekGeneration(db, catalog, bank, opts) {
  const target = opts.target ?? nextIsoWeek(opts.now);
  const boxes = (await db.listEnabledBoxes()).filter((b) => !opts.only_box_id || b.id === opts.only_box_id);
  const out = [];
  for (const box of boxes) {
    for (const track of box.tracks) {
      const base = { box_id: box.id, track, iso_year: target.iso_year, iso_week: target.iso_week };
      const existing = await db.getRun(box.id, track, target.iso_year, target.iso_week);
      const regen = !!opts.regen && opts.regen.box_id === box.id && opts.regen.track === track;
      if (existing && existing.status === "done" && !regen) {
        out.push({ ...base, status: "kept", regen_counter: existing.regen_counter, inserted: 0, kept_dates: [], deleted: 0 });
        continue;
      }
      const regen_counter = existing ? regen ? existing.regen_counter + 1 : existing.regen_counter : 0;
      const seed = weekSeed(box.id, track, target.iso_year, target.iso_week, regen_counter);
      const run = await db.upsertRun({
        ...base,
        generator_version: PROGRAMMING_VERSION,
        seed,
        regen_counter,
        status: "running",
        error: null,
        wod_ids: existing?.wod_ids ?? [],
        signatures: existing?.signatures ?? [],
        relaxations: []
      });
      try {
        await db.ensureGroup(box.id, TRACK_GROUP_NAME[track], box.owner_id);
        const recent = await db.recentSignatures(box.id, track, target, RECENT_WEEKS);
        const ctx = { box_id: box.id, created_by: box.owner_id, run_id: run.id, iso_year: target.iso_year, iso_week: target.iso_week };
        let rows;
        let signatures;
        let relaxations;
        if (track === "crossfit") {
          const week = generateWeek({ iso_year: target.iso_year, iso_week: target.iso_week, recent_signatures: recent }, catalog, bank, seed);
          rows = crossfitWeekRows(week, ctx);
          signatures = week.sessions.map((s) => s.signature);
          relaxations = [...week.relaxations, ...week.sessions.flatMap((s) => s.generator.relaxations.map((r) => `${DAY_LABEL[s.day]}:${r}`))];
        } else {
          const week = generateMuscuWeek({ iso_year: target.iso_year, iso_week: target.iso_week, recent_signatures: recent }, catalog, bank, seed);
          rows = muscuWeekRows(week, ctx);
          signatures = week.days.map((d) => d.wod.signature);
          relaxations = week.relaxations;
        }
        const previous = existing ? await db.listAutoRows(existing.id) : [];
        const keptDates = new Set(previous.filter((r) => r.edited_at || r.scored).map((r) => r.scheduled_date));
        const toDelete = previous.filter((r) => !keptDates.has(r.scheduled_date)).map((r) => r.id);
        if (toDelete.length) await db.deleteRows(toDelete);
        const keptIds = previous.filter((r) => keptDates.has(r.scheduled_date)).map((r) => r.id);
        const inserts = rows.filter((r) => !keptDates.has(r.scheduled_date));
        const ids = inserts.length ? await db.insertRows(inserts) : [];
        await db.updateRun(run.id, { status: "done", error: null, wod_ids: [...keptIds, ...ids], signatures, relaxations, seed, regen_counter });
        out.push({ ...base, status: "done", regen_counter, inserted: ids.length, kept_dates: [...keptDates].sort(), deleted: toDelete.length });
      } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        await db.updateRun(run.id, { status: "error", error: msg });
        out.push({ ...base, status: "error", regen_counter, inserted: 0, kept_dates: [], deleted: 0, error: msg });
      }
    }
  }
  return out;
}
export {
  AFTER_CLASS_DURATIONS,
  BANK_V1,
  BANK_VERSION,
  BEGINNER_MAX_EXERCISES,
  CARDIO_EXCLUDED_IDS,
  CATALOG_SNAPSHOT,
  CATEGORY_LABEL,
  DAY_LABEL,
  ENGINE_MIN_SHARE,
  ENGINE_VERSION,
  EQUIPMENT_FALLBACK,
  EQUIPMENT_LABEL,
  FUNCTIONAL_CATEGORIES,
  FUNCTIONAL_SKELETONS,
  HYBRID_CATEGORIES,
  HYBRID_SKELETONS,
  InvalidMuscuParams,
  InvalidSessionParams,
  LEVEL_LABEL,
  MAX_ATTEMPTS,
  MOVEMENT_CAPS,
  MUSCU_BANK_VERSION,
  MUSCU_DURATIONS,
  MUSCU_ENGINE_VERSION,
  MUSCU_MAX_ATTEMPTS,
  MUSCU_OBJECTIVES,
  MUSCU_OBJECTIVE_CYCLE,
  MUSCU_SKELETONS,
  MUSCU_TARGETS,
  MUSCU_TOLERANCE,
  MUSCU_WEEKLY_CAP_SETS,
  MUSCU_WEEK_DAYS,
  NoValidWod,
  OBJECTIVE_LABEL,
  PROGRAMMING_VERSION,
  RACK_ONLY_IDS,
  RECENT_WEEKS,
  REVEAL_HOUR_PARIS,
  RNG,
  RUN_MIN_M,
  SCHEMES,
  SESSION_BANK_VERSION,
  SESSION_ENGINE_VERSION,
  SESSION_SKELETONS,
  SESSION_TOLERANCE,
  TARGET_LABEL,
  TARGET_MUSCLES,
  TIME_BOUNDED,
  TOLERANCE,
  TRACKS,
  TRACK_GROUP_NAME,
  TRACK_LABEL,
  TRANSITION_MIN,
  UNIT_RANGES,
  VEST_LOAD_KG,
  VOLUME_CAP_FACTOR,
  VOLUME_CAP_SETS,
  WEEKLY_GYM_CAPS,
  WEEKLY_HSPU_IDS,
  WEEKLY_PULL_IDS,
  WEIGHTED_IDS,
  afterClassFilter,
  afterClassMuscles,
  availableTargets,
  bankFromRows,
  blocCRepsRx,
  cadenceFor,
  carriesIntention,
  catalogFromRows,
  categoriesFor,
  crossfitWeekRows,
  deathByMinute,
  engineShare,
  estimateAll,
  estimateBlock,
  estimateDuration,
  exerciseLine,
  forceBand,
  functionalRef,
  generateBlocC,
  generateMuscu,
  generateMuscuWeek,
  generateSession,
  generateWeek,
  hashSeed,
  heavyAllowed,
  isFunctionalCategory,
  isMuscuSkeletonRow,
  isSessionSkeletonRow,
  isSlowSkill,
  isoWeek,
  isoWeekMonday,
  ladderStep,
  loadText2 as loadText,
  loadsFor,
  movementById,
  movementCapFor,
  movementCapFromRow,
  movementCapToRow,
  movementFromRow,
  movementLine,
  movementLines,
  mulberry32,
  muscuLevelFor,
  muscuObjectiveForWeek,
  muscuSignature,
  muscuSkeletonToRow,
  muscuWeekRows,
  nameKey,
  nextIsoWeek,
  parisOffsetMinutes,
  percentForReps,
  primaryPattern,
  profileCategory,
  rackAllowed,
  render,
  renderMuscu,
  resolveMovement,
  revealAt,
  roundSeconds,
  runWeekGeneration,
  sessionSeconds,
  sessionSkeletonToRow,
  sideLabel,
  signature,
  skeletonToRow,
  stepLine,
  substitutionFor,
  targetAvailable,
  weekDates,
  weekSeed,
  weeklyGymVolume,
  weightFor
};
