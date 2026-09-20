// GÉNÉRÉ par packages/wod-engine/scripts/bundle-edge.mjs — ne pas éditer.

// packages/wod-engine/src/types.ts
var FUNCTIONAL_CATEGORIES = ["scaled", "inter", "rx", "rxplus", "elite", "pro"];
var HYBRID_CATEGORIES = ["women", "men", "women_pro", "men_pro"];
var MOVEMENT_GROUPS = [
  "press_h",
  "press_v",
  "pull_v",
  "row",
  "squat",
  "hinge",
  "lunge",
  "hip_ext",
  "curl",
  "triceps_ext",
  "fly",
  "raise",
  "shrug",
  "core_flex",
  "core_anti",
  "carry"
];
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
    unit: r.muscu_unit ?? "reps",
    priority: Number(r.priority ?? 3),
    priority_bodyweight: r.priority_bodyweight == null ? null : Number(r.priority_bodyweight),
    movement_group: r.movement_group ?? "carry"
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
function catalogFromRows(rows2) {
  const movements = rows2.map(movementFromRow);
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
  const pair2 = byBand[band];
  if (!pair2) return null;
  if (isFunctionalCategory(category)) return [pair2[0], pair2[1]];
  return [pair2[genderIndex(category)]];
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "squat",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "squat",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "hinge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "squat",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "lunge",
        "priority_bodyweight": null
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
        "unit": "m",
        "priority": 3,
        "movement_group": "carry",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "press_v",
        "priority_bodyweight": 3
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
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 5,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "press_h",
        "priority_bodyweight": 3
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "squat",
        "priority_bodyweight": 3
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
        "unit": "s",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "lunge",
        "priority_bodyweight": null
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
      "weight_functional": 10,
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "squat",
        "priority_bodyweight": 3
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "lunge",
        "priority_bodyweight": 3
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
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
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
            12,
            15
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 6,
        "weight_gym": 4,
        "unit": "reps",
        "priority": 2,
        "movement_group": "pull_v",
        "priority_bodyweight": null
      }
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "press_v",
        "priority_bodyweight": 3
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "press_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "press_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "press_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "press_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "hinge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hinge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "squat",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "squat",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "lunge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "hinge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hinge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "squat",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
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
      "notes": "Musculation \u2014 \xE0 deux jambes ; variante facile sans mat\xE9riel",
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "hinge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "hinge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": 2
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
        "unit": "s",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "m",
        "priority": 3,
        "movement_group": "carry",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "press_h",
        "priority_bodyweight": 3
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "press_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "press_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "fly",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "row",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "shrug",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "shrug",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "shrug",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "shrug",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 1,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "pull_v",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "press_h",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": 3
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 4,
        "movement_group": "press_h",
        "priority_bodyweight": 3
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "triceps_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "curl",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "carry",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "carry",
        "priority_bodyweight": null
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
        "unit": "s",
        "priority": 3,
        "movement_group": "carry",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "s",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": null
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
        "unit": "s",
        "priority": 3,
        "movement_group": "squat",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "hinge",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "raise",
        "priority_bodyweight": 2
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
        "unit": "s",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": 2
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
        "unit": "s",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_flex",
        "priority_bodyweight": 2
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "squat",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": 1
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
        "unit": "reps",
        "priority": 3,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "lunge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 5,
        "movement_group": "lunge",
        "priority_bodyweight": null
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
        "unit": "reps",
        "priority": 2,
        "movement_group": "hip_ext",
        "priority_bodyweight": null
      }
    },
    {
      "id": "incline_push_up",
      "name": "Incline Push-Ups",
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
      "notes": "Musculation \u2014 mains sur box / banc / marche ; variante facile sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps",
          "epaules_ant"
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
        "weight_bodyweight": 8,
        "weight_box": 6,
        "weight_gym": 4,
        "unit": "reps",
        "priority": 5,
        "movement_group": "press_h",
        "priority_bodyweight": 3
      }
    },
    {
      "id": "wall_push_up",
      "name": "Wall Push-Ups",
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
      "notes": "Musculation \u2014 variante facile sans mat\xE9riel",
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
        "weight_box": 2,
        "weight_gym": 2,
        "unit": "reps",
        "priority": 5,
        "movement_group": "press_h",
        "priority_bodyweight": 3
      }
    },
    {
      "id": "bird_dog",
      "name": "Bird Dog",
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
      "notes": "Musculation \u2014 reps altern\xE9es ; variante facile sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "lombaires",
          "fessiers"
        ],
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
            10,
            16
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 3,
        "movement_group": "core_anti",
        "priority_bodyweight": 2
      }
    },
    {
      "id": "bodyweight_reverse_lunge",
      "name": "Reverse Lunge",
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
      "notes": "Musculation \u2014 sans charge ; reps altern\xE9es ; variante facile sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "quadriceps"
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
            10,
            16
          ],
          "endurance": [
            16,
            24
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "movement_group": "lunge",
        "priority_bodyweight": 3
      }
    },
    {
      "id": "squat_hold",
      "name": "Squat Hold",
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
      "equipment": [],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "Musculation \u2014 unit\xE9 secondes ; variante facile sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "quadriceps",
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
        "unit": "s",
        "priority": 3,
        "movement_group": "squat",
        "priority_bodyweight": 1
      }
    },
    {
      "id": "pike_push_up_elevated",
      "name": "Pike Push-Ups sur\xE9lev\xE9es",
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
      "notes": "pieds sur\xE9lev\xE9s : plus vertical, plus proche du HSPU",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
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
            6,
            12
          ],
          "endurance": [
            12,
            20
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "press_v"
      }
    },
    {
      "id": "hindu_push_up",
      "name": "Pompes Hindu",
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
      "notes": null,
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "pecs",
          "triceps"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "debutant",
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
            25
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 2,
        "movement_group": "press_v"
      }
    },
    {
      "id": "handstand_hold",
      "name": "Handstand Hold",
      "family": "bodyweight",
      "pattern": [
        "push_v"
      ],
      "modality": "G",
      "grip": "none",
      "shoulder_load": "high",
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
      "notes": "tenue, unit\xE9 en secondes",
      "muscu": {
        "muscle_primary": "epaules",
        "muscle_secondary": [
          "tronc"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 20,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            20,
            60
          ]
        },
        "weight_bodyweight": 5,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "s",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "press_v"
      }
    },
    {
      "id": "prone_ytw",
      "name": "Prone Y-T-W",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "au sol, sans charge : trap\xE8zes moyens et bas",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [
          "epaules_post",
          "dos"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "raise"
      }
    },
    {
      "id": "reverse_snow_angel",
      "name": "Reverse Snow Angels",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": null,
      "muscu": {
        "muscle_primary": "epaules_post",
        "muscle_secondary": [
          "trapezes"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "raise"
      }
    },
    {
      "id": "diamond_push_up_decline",
      "name": "Pompes diamant d\xE9clin\xE9es",
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
      "notes": null,
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
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "press_h"
      }
    },
    {
      "id": "floor_triceps_extension",
      "name": "Extensions triceps au sol",
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
      "notes": "skull crusher au poids du corps, genoux ou pieds",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [
          "epaules_ant"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
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
            12,
            20
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "triceps_ext"
      }
    },
    {
      "id": "close_push_up_box",
      "name": "Pompes serr\xE9es sur box",
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
      "notes": null,
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [
          "pecs"
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
            10,
            15
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 2,
        "movement_group": "press_h"
      }
    },
    {
      "id": "archer_push_up",
      "name": "Pompes archer",
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
      "notes": "une main tendue : charge d\xE9cal\xE9e sur un c\xF4t\xE9",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps",
          "epaules_ant"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "avance",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            5,
            10
          ],
          "force": [
            3,
            6
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "press_h"
      }
    },
    {
      "id": "decline_push_up_wall",
      "name": "Pompes d\xE9clin\xE9es pieds au mur",
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
      "notes": null,
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
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 2,
        "movement_group": "press_h"
      }
    },
    {
      "id": "weighted_bag_push_up",
      "name": "Pompes lest\xE9es (sac)",
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
      "notes": "sac \xE0 dos charg\xE9 : progression quand les pompes deviennent faciles",
      "muscu": {
        "muscle_primary": "pecs",
        "muscle_secondary": [
          "triceps"
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
            4,
            6
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 3,
        "movement_group": "press_h"
      }
    },
    {
      "id": "inverted_row_table",
      "name": "Rowing invers\xE9 sous table",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "table, barre basse ou anneaux : le tirage horizontal sans mat\xE9riel",
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
        "setup_s": 15,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            8,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 9,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "row"
      }
    },
    {
      "id": "superman_pull",
      "name": "Superman Pull",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": null,
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "lombaires",
          "trapezes"
        ],
        "compound": false,
        "unilateral": false,
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
            10,
            15
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "row"
      }
    },
    {
      "id": "scapular_pull_up",
      "name": "Scapular Pull-Ups",
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
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pull_up_bar"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "barre fixe : r\xE9serv\xE9 au mode Box",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "trapezes"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
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
            12,
            20
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 3,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "band_pull_apart",
      "name": "Pull-apart \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "\xE9lastique : admis en sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "epaules_post",
        "muscle_secondary": [
          "trapezes"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            12,
            20
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "raise"
      }
    },
    {
      "id": "chin_up_supine",
      "name": "Tractions supination",
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
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pull_up_bar"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "barre fixe : r\xE9serv\xE9 au mode Box",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "dos"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
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
            5,
            10
          ],
          "force": [
            3,
            6
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 9,
        "weight_gym": 9,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "band_biceps_curl",
      "name": "Curls \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "\xE9lastique : admis en sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "avant_bras"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "curl"
      }
    },
    {
      "id": "towel_curl_isometric",
      "name": "Curls isom\xE9triques \xE0 la serviette",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "auto-r\xE9sistance : une main freine l'autre",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "avant_bras"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
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
            12,
            20
          ]
        },
        "weight_bodyweight": 6,
        "weight_box": 5,
        "weight_gym": 5,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 2,
        "movement_group": "curl"
      }
    },
    {
      "id": "bar_hang_shrug",
      "name": "Shrugs suspendus \xE0 la barre",
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
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pull_up_bar"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "barre fixe : r\xE9serv\xE9 au mode Box",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [
          "dos"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
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
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "shrug"
      }
    },
    {
      "id": "scapular_push_up",
      "name": "Scapular Push-Ups",
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
      "notes": "trap\xE8zes inf\xE9rieurs et dentel\xE9, en planche",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [
          "epaules_ant"
        ],
        "compound": false,
        "unilateral": false,
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
            10,
            20
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "shrug"
      }
    },
    {
      "id": "dead_hang",
      "name": "Suspension passive",
      "family": "gym",
      "pattern": [
        "pull_v"
      ],
      "modality": "G",
      "grip": "high",
      "shoulder_load": "low",
      "unit_default": "s",
      "units_allowed": [
        "s"
      ],
      "load_unit": null,
      "weight_functional": 0,
      "weight_hybrid": 0,
      "equipment": [
        "pull_up_bar"
      ],
      "cadence": null,
      "loads": null,
      "rep_ranges": null,
      "substitutions": null,
      "variant_up": null,
      "badge_key": null,
      "active": true,
      "version": 1,
      "notes": "barre fixe : r\xE9serv\xE9 au mode Box, unit\xE9 en secondes",
      "muscu": {
        "muscle_primary": "avant_bras",
        "muscle_secondary": [
          "dos"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 1,
        "setup_s": 15,
        "objectives": [
          "endurance"
        ],
        "rep_ranges": {
          "endurance": [
            20,
            60
          ]
        },
        "weight_bodyweight": 0,
        "weight_box": 9,
        "weight_gym": 9,
        "unit": "s",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "carry"
      }
    },
    {
      "id": "fingertip_push_up",
      "name": "Pompes sur les doigts",
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
      "notes": "doigts en appui : poignets et fl\xE9chisseurs",
      "muscu": {
        "muscle_primary": "avant_bras",
        "muscle_secondary": [
          "pecs",
          "triceps"
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
            6,
            12
          ],
          "endurance": [
            10,
            20
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "press_h"
      }
    },
    {
      "id": "bodyweight_wrist_curl",
      "name": "Flexions de poignet au poids du corps",
      "family": "bodyweight",
      "pattern": [
        "core"
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
      "notes": "\xE0 genoux, mains au sol",
      "muscu": {
        "muscle_primary": "avant_bras",
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            12,
            20
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "carry"
      }
    },
    {
      "id": "band_external_rotation",
      "name": "Rotations externes \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "\xE9lastique, coude au corps : admis en sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "coiffe",
        "muscle_secondary": [
          "epaules_post"
        ],
        "compound": false,
        "unilateral": true,
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
            12,
            20
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "raise"
      }
    },
    {
      "id": "band_face_pull",
      "name": "Face Pull \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "\xE9lastique \xE0 hauteur de visage",
      "muscu": {
        "muscle_primary": "coiffe",
        "muscle_secondary": [
          "epaules_post",
          "trapezes"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            12,
            20
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "raise"
      }
    },
    {
      "id": "prone_external_rotation",
      "name": "Rotations externes \xE0 plat ventre",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "sans charge, amplitude lente",
      "muscu": {
        "muscle_primary": "coiffe",
        "muscle_secondary": [
          "epaules_post"
        ],
        "compound": false,
        "unilateral": true,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
        "setup_s": 5,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 3,
        "movement_group": "raise"
      }
    },
    {
      "id": "band_lat_pulldown_kneeling",
      "name": "Tirage vertical \xE9lastique \xE0 genoux",
      "family": "bodyweight",
      "pattern": [
        "pull_v"
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
      "notes": "\xE9lastique ancr\xE9 haut, \xE0 genoux : amplitude compl\xE8te sans barre",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "band_single_arm_pulldown",
      "name": "Tirage \xE9lastique un bras",
      "family": "bodyweight",
      "pattern": [
        "pull_v"
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
      "notes": "un bras \xE0 la fois : corrige les asym\xE9tries",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
        ],
        "compound": true,
        "unilateral": true,
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
            14
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 3,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "band_bent_over_row",
      "name": "Rowing \xE9lastique buste pench\xE9",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "\xE9lastique sous les pieds, dos plat",
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 3,
        "movement_group": "row"
      }
    },
    {
      "id": "inverted_row_feet_elevated",
      "name": "Rowing invers\xE9 pieds sur\xE9lev\xE9s",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "pieds sur une chaise : le tirage horizontal le plus chargeant sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps",
          "trapezes"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "inter",
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
            6,
            12
          ],
          "force": [
            5,
            8
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "row"
      }
    },
    {
      "id": "towel_row_post",
      "name": "Rowing serviette autour d'un poteau",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "serviette autour d'un montant : partout, sans rien",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps",
          "avant_bras"
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 3,
        "movement_group": "row"
      }
    },
    {
      "id": "band_lat_pulldown",
      "name": "Tirage vertical \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "pull_v"
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
      "notes": "\xE9lastique ancr\xE9 en hauteur : le tirage vertical sans barre",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "biceps"
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "band_face_pull_high",
      "name": "Face Pull \xE9lastique haut",
      "family": "bodyweight",
      "pattern": [
        "pull_v"
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
      "notes": "\xE9lastique en hauteur, coudes hauts",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "trapezes",
          "epaules_post"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            12,
            20
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "band_curl_supine_grip",
      "name": "Curls \xE9lastique prise supination large",
      "family": "bodyweight",
      "pattern": [
        "pull_v"
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
      "notes": "\xE9lastique sous les pieds, coudes au corps",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "dos"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "band_hammer_curl",
      "name": "Curls marteau \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "pull_v"
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
      "notes": "prise neutre",
      "muscu": {
        "muscle_primary": "biceps",
        "muscle_secondary": [
          "avant_bras"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "pull_v"
      }
    },
    {
      "id": "chair_step_up",
      "name": "Step-up sur chaise",
      "family": "bodyweight",
      "pattern": [
        "lunge"
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
      "notes": "mont\xE9e contr\xF4l\xE9e, descente frein\xE9e",
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "quadriceps"
        ],
        "compound": true,
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 9,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "lunge"
      }
    },
    {
      "id": "lateral_lunge",
      "name": "Fente lat\xE9rale",
      "family": "bodyweight",
      "pattern": [
        "lunge"
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
      "notes": null,
      "muscu": {
        "muscle_primary": "fessiers",
        "muscle_secondary": [
          "quadriceps",
          "ischios"
        ],
        "compound": true,
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "lunge"
      }
    },
    {
      "id": "bird_dog_hold",
      "name": "Bird Dog tenu",
      "family": "bodyweight",
      "pattern": [
        "core"
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
      "notes": "bras et jambe oppos\xE9s, bassin fixe",
      "muscu": {
        "muscle_primary": "lombaires",
        "muscle_secondary": [
          "fessiers",
          "tronc"
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
            14
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "core_anti"
      }
    },
    {
      "id": "pallof_press_band",
      "name": "Pallof Press \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "core"
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
      "notes": "\xE9lastique lat\xE9ral : anti-rotation",
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [
          "tronc"
        ],
        "compound": false,
        "unilateral": true,
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "core_anti"
      }
    },
    {
      "id": "prone_ytw_hold",
      "name": "Prone Y-T-W tenu",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "chaque position tenue 3 s",
      "muscu": {
        "muscle_primary": "trapezes",
        "muscle_secondary": [
          "epaules_post"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
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
            25
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "raise"
      }
    },
    {
      "id": "band_row",
      "name": "Rowing \xE0 l'\xE9lastique",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "\xE9lastique ancr\xE9 : le tirage horizontal partout",
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 3,
        "movement_group": "row"
      }
    },
    {
      "id": "scapular_pull_floor",
      "name": "Scapular Pull au sol",
      "family": "bodyweight",
      "pattern": [
        "pull_h"
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
      "notes": "\xE0 plat ventre, omoplates seules : sans barre",
      "muscu": {
        "muscle_primary": "dos",
        "muscle_secondary": [
          "trapezes"
        ],
        "compound": false,
        "unilateral": false,
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
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "row"
      }
    },
    {
      "id": "band_overhead_triceps_extension",
      "name": "Extensions triceps \xE9lastique au-dessus de la t\xEAte",
      "family": "bodyweight",
      "pattern": [
        "push_v"
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
      "notes": "\xE9lastique derri\xE8re la nuque",
      "muscu": {
        "muscle_primary": "triceps",
        "muscle_secondary": [
          "epaules"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "triceps_ext"
      }
    },
    {
      "id": "bulgarian_split_squat_chair",
      "name": "Fentes bulgares (pied sur chaise)",
      "family": "bodyweight",
      "pattern": [
        "lunge"
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
      "notes": "pied arri\xE8re sur une chaise : la fente la plus chargeante sans mat\xE9riel",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "inter",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 4,
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
            5,
            8
          ]
        },
        "weight_bodyweight": 9,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "lunge"
      }
    },
    {
      "id": "reverse_lunge_slow",
      "name": "Fente arri\xE8re lente",
      "family": "bodyweight",
      "pattern": [
        "lunge"
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
      "notes": "descente contr\xF4l\xE9e, sans charge",
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
        "seconds_per_rep": 4,
        "setup_s": 5,
        "objectives": [
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 2,
        "movement_group": "lunge"
      }
    },
    {
      "id": "jump_squat",
      "name": "Squat saut\xE9",
      "family": "bodyweight",
      "pattern": [
        "squat"
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
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers",
          "mollets"
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            16
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "squat"
      }
    },
    {
      "id": "cossack_squat",
      "name": "Cossack Squat",
      "family": "bodyweight",
      "pattern": [
        "squat"
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
      "notes": "squat lat\xE9ral, jambe oppos\xE9e tendue",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers",
          "ischios"
        ],
        "compound": true,
        "unilateral": true,
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
            6,
            12
          ],
          "endurance": [
            12,
            20
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 2,
        "movement_group": "squat"
      }
    },
    {
      "id": "shrimp_squat",
      "name": "Shrimp Squat",
      "family": "bodyweight",
      "pattern": [
        "squat"
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
      "notes": null,
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
        "seconds_per_rep": 5,
        "setup_s": 10,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            4,
            8
          ],
          "force": [
            3,
            5
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 3,
        "movement_group": "squat"
      }
    },
    {
      "id": "sissy_squat",
      "name": "Sissy Squat",
      "family": "bodyweight",
      "pattern": [
        "squat"
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
      "notes": "quadriceps en \xE9tirement, appui l\xE9ger",
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [],
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
            12,
            20
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "squat"
      }
    },
    {
      "id": "jumping_lunge",
      "name": "Fentes saut\xE9es",
      "family": "bodyweight",
      "pattern": [
        "lunge"
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
      "notes": null,
      "muscu": {
        "muscle_primary": "quadriceps",
        "muscle_secondary": [
          "fessiers",
          "mollets"
        ],
        "compound": true,
        "unilateral": true,
        "level_min": "inter",
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
            10,
            16
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 3,
        "movement_group": "lunge"
      }
    },
    {
      "id": "single_leg_calf_raise",
      "name": "Mollets unilat\xE9raux",
      "family": "bodyweight",
      "pattern": [
        "squat"
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
      "notes": "sur une marche, amplitude compl\xE8te",
      "muscu": {
        "muscle_primary": "mollets",
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            12,
            20
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 9,
        "weight_box": 8,
        "weight_gym": 8,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "raise"
      }
    },
    {
      "id": "nordic_curl_assisted",
      "name": "Nordic Curl assist\xE9",
      "family": "bodyweight",
      "pattern": [
        "hinge"
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
      "notes": "pieds bloqu\xE9s, descente frein\xE9e",
      "muscu": {
        "muscle_primary": "ischios",
        "muscle_secondary": [
          "fessiers"
        ],
        "compound": true,
        "unilateral": false,
        "level_min": "avance",
        "load_mode": "bodyweight",
        "rm_reference": null,
        "rm_factor": null,
        "seconds_per_rep": 5,
        "setup_s": 20,
        "objectives": [
          "hypertrophie",
          "force"
        ],
        "rep_ranges": {
          "hypertrophie": [
            4,
            8
          ],
          "force": [
            3,
            6
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 1,
        "movement_group": "hinge"
      }
    },
    {
      "id": "weighted_dead_bug",
      "name": "Dead Bug lest\xE9",
      "family": "bodyweight",
      "pattern": [
        "core"
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
      "notes": "sac ou bouteilles dans les mains",
      "muscu": {
        "muscle_primary": "tronc",
        "muscle_secondary": [
          "obliques"
        ],
        "compound": false,
        "unilateral": false,
        "level_min": "debutant",
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
            14
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "core_anti"
      }
    },
    {
      "id": "floor_toes_to_bar",
      "name": "Toes-to-Bar au sol",
      "family": "bodyweight",
      "pattern": [
        "core"
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
      "notes": "allong\xE9, mains au sol au-dessus de la t\xEAte",
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
          "hypertrophie",
          "endurance"
        ],
        "rep_ranges": {
          "hypertrophie": [
            10,
            15
          ],
          "endurance": [
            20,
            30
          ]
        },
        "weight_bodyweight": 7,
        "weight_box": 6,
        "weight_gym": 6,
        "unit": "reps",
        "priority": 5,
        "priority_bodyweight": 1,
        "movement_group": "core_flex"
      }
    },
    {
      "id": "side_plank_rotation",
      "name": "Side Plank avec rotation",
      "family": "bodyweight",
      "pattern": [
        "core"
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
      "notes": null,
      "muscu": {
        "muscle_primary": "obliques",
        "muscle_secondary": [
          "tronc"
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
            14
          ],
          "endurance": [
            15,
            25
          ]
        },
        "weight_bodyweight": 8,
        "weight_box": 7,
        "weight_gym": 7,
        "unit": "reps",
        "priority": 4,
        "priority_bodyweight": 2,
        "movement_group": "core_anti"
      }
    }
  ]
};

// packages/wod-engine/src/bank/functional/couplet_for_time_21_15_9.ts
var slots = [
  { pick: { family: ["barbell", "dumbbell"], pattern_any: ["squat", "hinge", "push_v"] }, qty: "scheme" },
  { pick: { family: ["gym"], pattern_any: ["pull_v", "push_v", "core"], pattern_not_of_slot: 0 }, qty: "scheme" }
];
var couplet_for_time_21_15_9 = {
  id: "couplet_for_time_21_15_9",
  discipline: "functional",
  format: "for_time",
  duration_range: [8, 20],
  durations: [8, 12],
  intentions: ["mixed", "gym", "force"],
  band_by_intention: { mixed: "medium", force: "heavy", gym: "light" },
  scheme: [21, 15, 9],
  rounds: "scheme",
  slots,
  variants: [
    { id: "21-15-9", slots, scheme: [21, 15, 9], duration_range: [8, 12] },
    { id: "9-15-21", slots, scheme: [9, 15, 21], duration_range: [8, 12] },
    { id: "15-12-9", slots, scheme: [15, 12, 9], duration_range: [8, 12] },
    { id: "9-12-15", slots, scheme: [9, 12, 15], duration_range: [8, 12] },
    { id: "21-18-15-12-9-6-3", slots, scheme: [21, 18, 15, 12, 9, 6, 3], duration_range: [12, 20] },
    { id: "3-6-9-12-15-18-21", slots, scheme: [3, 6, 9, 12, 15, 18, 21], duration_range: [12, 20] }
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
  duration_range: [12, 20],
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
  duration_range: [12, 20],
  durations: [12, 15, 20],
  intentions: ["mixed", "cardio", "gym"],
  band_by_intention: { mixed: "medium", cardio: "light", gym: "light" },
  rounds: "amrap",
  slots: [
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["barbell", "dumbbell", "kettlebell", "wallball"], pattern_any: ["squat", "hinge", "push_v"] }, qty: "range" },
    { pick: { family: ["gym", "bodyweight", "jump_rope"], pattern_any: ["pull_v", "core", "mono"], pattern_not_of_slot: 1 }, qty: "range" }
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
  duration_range: [12, 20],
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

// packages/wod-engine/src/bank/functional/triplet_for_time_classics.ts
var slots2 = [
  { pick: { family: ["barbell", "dumbbell", "kettlebell"], pattern_any: ["squat", "hinge", "push_v"] }, qty: "scheme" },
  { pick: { family: ["gym"], pattern_any: ["pull_v", "push_v", "core"], pattern_not_of_slot: 0 }, qty: "scheme" },
  { pick: { family: ["bodyweight", "box", "jump_rope"], pattern_not_of_slot: 1 }, qty: "scheme" }
];
var triplet_for_time_classics = {
  id: "triplet_for_time_classics",
  discipline: "functional",
  format: "for_time",
  duration_range: [8, 20],
  durations: [10, 15, 20],
  intentions: ["mixed", "gym", "force"],
  band_by_intention: { mixed: "medium", gym: "light", force: "heavy" },
  scheme: [21, 15, 9],
  rounds: "scheme",
  slots: slots2,
  variants: [
    { id: "21-15-9", slots: slots2, scheme: [21, 15, 9], duration_range: [8, 12] },
    { id: "9-15-21", slots: slots2, scheme: [9, 15, 21], duration_range: [8, 12] },
    { id: "15-12-9", slots: slots2, scheme: [15, 12, 9], duration_range: [8, 12] },
    { id: "9-12-15", slots: slots2, scheme: [9, 12, 15], duration_range: [8, 12] },
    { id: "21-18-15-12-9-6-3", slots: slots2, scheme: [21, 18, 15, 12, 9, 6, 3], duration_range: [12, 20] },
    { id: "3-6-9-12-15-18-21", slots: slots2, scheme: [3, 6, 9, 12, 15, 18, 21], duration_range: [12, 20] }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8.5, note: "Transitions courtes et s\xE9ries fractionn\xE9es avant l\u2019\xE9chec." }
};

// packages/wod-engine/src/bank/functional/chipper_descending.ts
var slots3 = [
  { pick: { family: ["erg"], unit: "cal" }, qty: "scheme" },
  { pick: { family: ["box", "jump_rope"] }, qty: "scheme" },
  { pick: { family: ["kettlebell", "dumbbell", "wallball"] }, qty: "scheme" },
  { pick: { family: ["barbell"], band: "light" }, qty: "scheme" },
  { pick: { family: ["bodyweight"], pattern_any: ["core", "mono"] }, qty: "scheme" }
];
var chipper_descending = {
  id: "chipper_descending",
  discipline: "functional",
  format: "chipper",
  duration_range: [8, 14],
  durations: [15, 20],
  intentions: ["mixed", "cardio"],
  band_by_intention: { mixed: "medium", cardio: "light" },
  scheme: [30, 25, 20, 15, 10],
  rounds: "scheme",
  barbell_low_scheme: true,
  slots: slots3,
  variants: [
    { id: "50-40-30-20-10", slots: slots3, scheme: [50, 40, 30, 20, 10], duration_range: [11, 14] },
    { id: "40-30-20-10", slots: slots3.slice(0, 4), scheme: [40, 30, 20, 10], duration_range: [8, 10] },
    { id: "30-25-20-15-10", slots: slots3, scheme: [30, 25, 20, 15, 10], duration_range: [8, 10] }
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
  duration_range: [20, 30],
  durations: [20, 30],
  intentions: ["mixed", "cardio"],
  band_by_intention: { mixed: "medium", cardio: "light" },
  rounds: { min: 1, max: 1 },
  slots: [
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["sled", "carry", "sandbag"], unit: "m" }, qty: "range" },
    { pick: { family: ["erg"], unit: "cal" }, qty: "range", role: "erg diff\xE9rent du (1)" },
    { pick: { family: ["run"], unit: "m" }, qty: "range", qty_max: 800 },
    { pick: { family: ["bodyweight", "gym"], pattern_any: ["core", "pull_v", "push_v"] }, qty: "range" }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 7, note: "Stations encha\xEEn\xE9es, ergs \xE0 85 %." }
};

// packages/wod-engine/src/bank/functional/emom_alternating.ts
var pair = [
  { pick: { family: ["barbell", "dumbbell", "kettlebell"] }, qty: "range" },
  { pick: { family: ["gym", "bodyweight", "erg"], pattern_not_of_slot: 0 }, qty: "range" }
];
var triplet = [
  { pick: { family: ["barbell", "dumbbell", "kettlebell"] }, qty: "range" },
  { pick: { family: ["gym"] }, qty: "range" },
  { pick: { family: ["erg", "bodyweight", "jump_rope"], pattern_not_of_slot: 1 }, qty: "range" }
];
var five = [
  ...triplet,
  { pick: { family: ["bodyweight", "box"], pattern_not_of_slot: 1 }, qty: "range" },
  { pick: { family: ["erg", "jump_rope"], pattern_not_of_slot: 3 }, qty: "range" }
];
var emom_alternating = {
  id: "emom_alternating",
  discipline: "functional",
  format: "emom",
  duration_range: [10, 20],
  durations: [12, 15, 20],
  intentions: ["mixed", "gym", "force"],
  band_by_intention: { mixed: "medium", gym: "light", force: "heavy" },
  rest: { every_s: 60 },
  station_count: { by_duration: { 12: 3, 15: 3, 20: 4 } },
  slots: [
    { pick: { family: ["barbell"] }, qty: "range" },
    { pick: { family: ["gym"] }, qty: "range" },
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["bodyweight", "jump_rope"] }, qty: "range", optional: true }
  ],
  variants: [
    { id: "EMOM-five", slots: five, rest: { every_s: 60 }, duration_range: [10, 20] },
    { id: "E2MOM-triplet", slots: triplet, rest: { every_s: 120 }, duration_range: [12, 20] },
    { id: "E3MOM-pair", slots: pair, rest: { every_s: 180 }, duration_range: [15, 20] }
  ],
  score_type: "reps_total",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 7, note: "Garder au moins un tiers de chaque intervalle pour r\xE9cup\xE9rer." }
};

// packages/wod-engine/src/bank/functional/interval_work_rest.ts
var interval_work_rest = {
  id: "interval_work_rest",
  discipline: "functional",
  format: "interval",
  duration_range: [15, 20],
  durations: [15, 20],
  intentions: ["mixed", "cardio", "force"],
  band_by_intention: { mixed: "medium", cardio: "light", force: "heavy" },
  rest: { every_s: [180, 240] },
  rounds: { min: 4, max: 6 },
  max_work_fraction: 0.65,
  slots: [
    { pick: { family: ["erg"], unit: "cal" }, qty: "range" },
    { pick: { family: ["barbell", "dumbbell"], pattern_any: ["hinge", "squat"] }, qty: "range" },
    { pick: { family: ["bodyweight", "jump_rope"], pattern_any: ["mono"] }, qty: "range" }
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
  duration_range: [8, 12],
  durations: [10, 15],
  intentions: ["mixed", "gym"],
  ladder_mode: "open",
  band_by_intention: { mixed: "medium", gym: "light" },
  scheme: [3, 6],
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

// packages/wod-engine/src/bank/functional/ladder_finite.ts
var slots4 = [
  { pick: { family: ["barbell", "dumbbell"], pattern_any: ["squat", "push_v", "hinge"] }, qty: "scheme" },
  { pick: { family: ["gym", "bodyweight"], pattern_any: ["pull_v", "push_v", "core"], pattern_not_of_slot: 0 }, qty: "scheme" }
];
var ladder_finite = {
  id: "ladder_finite",
  discipline: "functional",
  format: "ladder",
  duration_range: [4, 12],
  durations: [10, 15, 20],
  intentions: ["mixed", "gym"],
  band_by_intention: { mixed: "medium", gym: "light" },
  ladder_mode: "finite",
  scheme: [3, 6, 9, 12],
  rounds: "scheme",
  slots: slots4,
  variants: [
    { id: "3-6-9-12", slots: slots4, scheme: [3, 6, 9, 12], duration_range: [4, 8] },
    { id: "12-9-6-3", slots: slots4, scheme: [12, 9, 6, 3], duration_range: [4, 8] },
    { id: "2-4-6-8-10", slots: slots4, scheme: [2, 4, 6, 8, 10], duration_range: [4, 8] },
    { id: "10-8-6-4-2", slots: slots4, scheme: [10, 8, 6, 4, 2], duration_range: [4, 8] },
    { id: "3-6-9-12-9-6-3", slots: slots4, scheme: [3, 6, 9, 12, 9, 6, 3], duration_range: [8, 12] },
    { id: "2-4-6-8-10-8-6-4-2", slots: slots4, scheme: [2, 4, 6, 8, 10, 8, 6, 4, 2], duration_range: [8, 12] }
  ],
  score_type: "time",
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8, note: "Rythme progressif, garder des s\xE9ries propres sur le sommet." }
};

// packages/wod-engine/src/bank/functional/death_by.ts
var death_by = {
  id: "death_by",
  discipline: "functional",
  format: "death_by",
  duration_range: [10, 20],
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
  duration_range: [8, 10],
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
  duration_range: [8, 15],
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
  duration_range: [12, 20],
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
  duration_range: [10, 20],
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
  duration_range: [15, 20],
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
  duration_range: [15, 30],
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
  duration_range: [15, 30],
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
  duration_range: [15, 30],
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
  duration_range: [8, 15],
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
  duration_range: [15, 28],
  durations: [15, 20],
  intentions: ["force", "interval"],
  band_by_intention: { force: "heavy", interval: "heavy" },
  rest: { every_s: 240 },
  rounds: { min: 4, max: 7 },
  max_work_fraction: 0.7,
  slots: [],
  variants: [
    {
      id: "25m-every4",
      duration_range: [16, 28],
      rest: { every_s: 240 },
      rounds: { min: 4, max: 7 },
      slots: [
        { pick: { ids: ["sled_push"], unit: "m" }, qty: "fixed", fixed: 25 },
        { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed: 200 }
      ]
    },
    {
      id: "15m-every3",
      duration_range: [15, 21],
      rest: { every_s: 180 },
      rounds: { min: 5, max: 7 },
      slots: [
        { pick: { ids: ["sled_push"], unit: "m" }, qty: "fixed", fixed: 15 },
        { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed: 200 }
      ]
    }
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
  duration_range: [15, 30],
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
  duration_range: [18, 22],
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
  duration_range: [20, 45],
  durations: [20, 30, 35, 40, 45],
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
  duration_range: [10, 20],
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
  duration_range: [10, 20],
  durations: [10, 15, 20],
  intentions: ["run", "engine"],
  band_by_intention: { run: "light", engine: "light" },
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

// packages/wod-engine/src/bank/hybrid/engine_negative_split.ts
var engine_negative_split = {
  id: "engine_negative_split",
  discipline: "hybrid",
  format: "continuous",
  duration_range: [30, 40],
  durations: [30, 35, 40],
  intentions: ["aerobic"],
  band_by_intention: { aerobic: "light" },
  rounds: { min: 1, max: 5 },
  slots: [
    { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed: 800 },
    { pick: { ids: ["row", "ski_erg"], unit: "m" }, qty: "fixed", fixed: 750 },
    { pick: { ids: ["run"], unit: "m" }, qty: "fixed", fixed: 800 },
    { pick: { ids: ["bike_erg"], unit: "m" }, qty: "fixed", fixed: 1500 }
  ],
  station_count: { min: 3, max: 4 },
  score_type: "distance",
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: {
    rpe: 6,
    note: "Zone 3, respiration nasale tenable. Seconde moiti\xE9 un cran plus vite que la premi\xE8re, sans jamais passer en zone 4."
  }
};

// packages/wod-engine/src/bank/muscu.ts
var slot = (role, muscle, opts = {}) => ({ role, muscle, ...opts });
var main = (m, o) => slot("main_compound", m, o);
var sec = (m, o) => slot("secondary_compound", m, o);
var iso = (m, o) => slot("isolation", m, o);
var core = (m, o) => slot("core", m, o);
var calves = (o) => slot("calves", "mollets", o);
var OPT = { optional: true };
var PAIR = { pair: true };
var HIP_THRUST_LOADED = ["hip_thrust", "db_hip_thrust", "hip_thrust_machine"];
var RDL = ["romanian_deadlift", "db_rdl", "good_morning", "bodyweight_single_leg_rdl"];
var ABDUCTION = ["hip_abduction_machine", "cable_hip_abduction", "banded_hip_abduction"];
var KICKBACK = ["glute_kickback", "cable_pull_through", "frog_pump"];
var LEG_CURL = ["leg_curl", "nordic_curl", "bodyweight_single_leg_rdl"];
var ANTI_ROTATION = ["pallof_press", "dead_bug", "plank_hold", "hollow_hold", "ab_wheel", "vacuum"];
var LATERAL = ["side_plank", "db_side_bend", "oblique_crunch", "hanging_oblique_raise", "oblique_bench_raise", "rotation_machine", "crunch_with_rotation", "standing_rotation"];
var CARRY = ["db_farmer_carry", "suitcase_carry"];
var TRICEPS_COMPOUND = ["close_grip_bench", "close_grip_dips", "machine_dips", "diamond_push_up", "dips"];
var PULL_V = { groups: ["pull_v"] };
var ROW = { groups: ["row"] };
var LUNGE = { unilateral: true, groups: ["lunge"] };
var FLY = { groups: ["fly"] };
var RAISE = { groups: ["raise"] };
var SHRUG = { groups: ["shrug"] };
var TRI_EXT = { groups: ["triceps_ext"] };
var PULLOVER = { groups: ["pull_v"] };
var T = {
  push: {
    hypertrophie: [main("pecs"), sec("epaules"), iso("pecs", FLY), iso("epaules", RAISE), iso("triceps", TRI_EXT), core("tronc", OPT)],
    force: [main("pecs"), main("epaules"), iso("triceps", TRI_EXT), iso("epaules_post", { ...OPT, ...FLY }), iso("epaules", { ...OPT, ...RAISE })],
    endurance: [sec("pecs"), sec("epaules"), iso("pecs", FLY), iso("triceps", TRI_EXT), iso("epaules", { ...OPT, ...RAISE })]
  },
  pull: {
    hypertrophie: [main("dos", PULL_V), sec("dos", ROW), iso("epaules_post", FLY), iso("biceps"), iso("trapezes", { ...OPT, ...SHRUG }), core(["tronc", "lombaires"], OPT)],
    force: [main("dos", PULL_V), sec("dos", ROW), iso("biceps"), iso("trapezes", { ...OPT, ...SHRUG }), iso("epaules_post", { ...OPT, ...FLY })],
    endurance: [sec("dos", PULL_V), sec("dos", ROW), iso("epaules_post", FLY), iso("biceps"), core(["tronc", "lombaires"], OPT)]
  },
  jambes: {
    hypertrophie: [main("quadriceps"), sec("ischios", { ids: RDL }), sec(["quadriceps", "fessiers"], LUNGE), iso("quadriceps", PAIR), iso("ischios", { ids: LEG_CURL }), calves()],
    force: [main("quadriceps"), main(["ischios", "fessiers"]), sec("quadriceps", { ...OPT, ...LUNGE }), iso("ischios", { ...OPT, ids: LEG_CURL }), calves(OPT)],
    endurance: [sec("quadriceps"), sec(["ischios", "fessiers"]), iso(["quadriceps", "fessiers"], PAIR), calves(), core("tronc", OPT)]
  },
  bas: {
    hypertrophie: [main("quadriceps"), sec("fessiers", { ids: HIP_THRUST_LOADED }), sec("ischios", { ids: RDL }), iso(["quadriceps", "fessiers"], PAIR), iso("ischios", { ...OPT, ids: LEG_CURL }), core(["tronc", "lombaires"], OPT)],
    force: [main("quadriceps"), sec("ischios", { ids: RDL }), sec("fessiers", { ...OPT, ids: HIP_THRUST_LOADED }), iso(["quadriceps", "fessiers"], PAIR), core(["lombaires", "tronc"], OPT)],
    endurance: [sec("quadriceps"), sec("fessiers"), iso(["ischios", "fessiers"], PAIR), core("tronc"), calves(OPT)]
  },
  full_body: {
    hypertrophie: [main("quadriceps"), main("pecs"), sec("dos"), sec(["ischios", "fessiers"]), iso("epaules", OPT), core("tronc", OPT)],
    force: [main("quadriceps"), main("pecs"), main("dos"), sec("ischios", OPT)],
    endurance: [sec(["quadriceps", "fessiers"]), sec("pecs"), sec("dos"), sec(["ischios", "fessiers"]), core("tronc", OPT)]
  },
  tronc: {
    hypertrophie: [core("tronc"), core(["obliques", "tronc"]), core("lombaires"), core("tronc", OPT)],
    // Force indisponible sur le Tronc (M8) : squelette conservé pour la table, refusé par le moteur (`force_tronc`)
    force: [core("tronc"), core("obliques"), core("lombaires"), core("tronc", OPT)],
    endurance: [core("tronc", { ids: ANTI_ROTATION }), core(["obliques", "tronc"], { ids: LATERAL }), core("tronc", { ids: CARRY }), core("lombaires")]
  },
  haut: {
    hypertrophie: [main("pecs"), main("dos", PULL_V), sec("epaules"), iso("biceps"), iso("triceps", TRI_EXT), iso("epaules_post", { ...OPT, ...FLY })],
    force: [main("pecs"), main("epaules"), main("dos", PULL_V), iso("triceps", { ...OPT, ...TRI_EXT }), iso("epaules_post", { ...OPT, ...FLY })],
    endurance: [sec("pecs"), sec("dos", PULL_V), sec("epaules"), iso(["biceps", "triceps"]), core("tronc", OPT)]
  },
  dos: {
    hypertrophie: [main("dos", PULL_V), sec("dos", ROW), iso("dos", { ...OPT, ...PAIR }), iso("epaules_post", FLY), iso("trapezes", { ...OPT, ...SHRUG }), iso("lombaires", OPT)],
    force: [main("dos", PULL_V), sec("dos", ROW), iso("trapezes", SHRUG), iso("epaules_post", { ...OPT, ...FLY }), iso("lombaires", OPT)],
    endurance: [sec("dos", PULL_V), sec("dos", ROW), iso("epaules_post", FLY), iso("lombaires"), iso("trapezes", { ...OPT, ...SHRUG })]
  },
  epaules: {
    hypertrophie: [main("epaules"), iso("epaules", RAISE), iso("epaules_post", FLY), iso("trapezes", { ...OPT, ...SHRUG })],
    force: [main("epaules"), iso("epaules", RAISE), iso("epaules_post", FLY), iso("trapezes", { ...OPT, ...SHRUG })],
    endurance: [sec("epaules"), iso("epaules", RAISE), iso("epaules_post", FLY), iso("trapezes", { ...OPT, ...SHRUG })]
  },
  bras: {
    hypertrophie: [sec("triceps", { ids: TRICEPS_COMPOUND }), iso("biceps"), iso("triceps", TRI_EXT), iso("avant_bras", { ...OPT, groups: ["carry"] })],
    force: [main("triceps", { ids: TRICEPS_COMPOUND }), iso("biceps"), iso("triceps", TRI_EXT)],
    endurance: [sec("triceps", { ids: TRICEPS_COMPOUND }), iso("biceps"), iso("triceps", TRI_EXT)]
  },
  pecs: {
    hypertrophie: [main("pecs"), iso("pecs", FLY), iso("pecs", PULLOVER), iso("triceps", TRI_EXT), core("tronc", OPT)],
    force: [main("pecs"), iso("pecs", FLY), iso("triceps", TRI_EXT), iso("pecs", { ...OPT, ...PULLOVER })],
    endurance: [sec("pecs"), iso("pecs", FLY), iso("triceps", TRI_EXT), iso("pecs", { ...OPT, ...PULLOVER })]
  },
  fessiers: {
    hypertrophie: [
      main("fessiers", { ids: HIP_THRUST_LOADED }),
      sec("ischios", { ids: RDL }),
      sec("fessiers", LUNGE),
      iso("ischios", { ids: LEG_CURL }),
      iso("fessiers", { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }),
      core("lombaires", OPT)
    ],
    force: [main("fessiers", { ids: HIP_THRUST_LOADED }), main("ischios", { ids: RDL }), sec("fessiers", { ...OPT, ...LUNGE }), iso("ischios", { ...OPT, ids: LEG_CURL }), core("lombaires", OPT)],
    endurance: [sec("fessiers", { ids: HIP_THRUST_LOADED }), sec("ischios", { ids: RDL }), sec("fessiers", LUNGE), iso("fessiers", { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }), iso("ischios", { ...OPT, ids: LEG_CURL }), core("lombaires", OPT)]
  },
  fessiers_ischios: {
    hypertrophie: [main("ischios", { ids: RDL }), main("fessiers", { ids: HIP_THRUST_LOADED }), sec(["fessiers", "ischios"], LUNGE), iso("ischios", { ids: LEG_CURL }), iso("fessiers", { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }), core("lombaires", OPT)],
    force: [main("ischios", { ids: RDL }), main("fessiers", { ids: HIP_THRUST_LOADED }), sec(["fessiers", "ischios"], { ...OPT, ...LUNGE }), iso("ischios", { ...OPT, ids: LEG_CURL }), core("lombaires", OPT)],
    endurance: [sec("ischios", { ids: RDL }), sec("fessiers", { ids: HIP_THRUST_LOADED }), sec(["fessiers", "ischios"], LUNGE), iso("ischios", { ids: LEG_CURL }), iso("fessiers", { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }), core("lombaires", OPT)]
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
var SESSION_BANK_VERSION = 3;
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
var building = (id, movement, pattern, tempo, percent = 55, name) => ({
  id,
  movement,
  pattern,
  tempo,
  minutes: 8,
  ...name ? { name } : {},
  steps: [{ sets: 3, reps: 5, percent, rest_s: 90, note: percent === null ? "strict, qualit\xE9 avant quantit\xE9" : "building tempo" }]
});
var B_OHS = building("b_ohs_tempo", "overhead_squat", "squat", "3-1-1-1");
var B_SNATCH_BALANCE = building("b_snatch_balance", "snatch_balance", "squat", "2-0-X-1", 50, "Snatch Balance");
var B_STRICT_PULL_UP = building("b_strict_pull_up", "strict_pull_up", "pull_v", "2-1-2-1", null);
var B_PUSH_PRESS = building("b_push_press_tempo", "push_press", "push_v", "2-0-1-2");
var B_STRICT_PRESS = building("b_strict_press_tempo", "strict_press", "push_v", "3-0-1-1");
var B_RING_DIP = building("b_ring_dip", "ring_dip", "push_v", "2-1-2-1", null);
var B_STRICT_HSPU = building("b_strict_hspu", "strict_handstand_push_up", "push_v", "2-1-2-1", null);
var B_FRONT_SQUAT = building("b_front_squat_pause", "front_squat", "squat", "2-2-X-1");
var B_FRONT_RACK_LUNGE = building("b_front_rack_lunge", "front_rack_lunge", "lunge", "2-1-1-1");
var B_GHD = building("b_ghd_sit_up", "ghd_sit_up", "core", "2-1-1-1", null);
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
    skill: {
      reps: 5,
      rounds: 4,
      every_s: 90,
      progression: { a: "Kip Swings amples + Scap Pull-Ups (3 \xD7 8), fermeture des hanches vers la barre", b: "Chest-to-Bar assist\xE9s \xE9lastique ou Jumping C2B avec pause poitrine \xE0 la barre (3 \xD7 5)" },
      substitutions: { scaled: "Banded Pull-Ups", inter: "Pull-ups", rxplus: "Chest-to-Bar", elite: "Bar Muscle-ups", pro: "Bar Muscle-ups" }
    }
  },
  {
    id: "skill_hspu",
    kind: "skill",
    movement: "handstand_push_up",
    minutes: 15,
    skill: {
      reps: 6,
      rounds: 4,
      every_s: 90,
      progression: { a: "Handstand Hold face au mur (3 \xD7 30 s), gainage et coudes verrouill\xE9s", b: "Descentes n\xE9gatives 5 s en Handstand Push-Up ou Pike Push-Ups pieds sur box (3 \xD7 5)" },
      substitutions: { scaled: "Pike Push-Ups", inter: "Half Wall Walks", rxplus: "Strict Handstand Push-Ups", elite: "Strict Handstand Push-Ups", pro: "Strict Handstand Push-Ups" }
    }
  },
  {
    id: "skill_bmu",
    kind: "skill",
    movement: "bar_muscle_up",
    minutes: 15,
    skill: {
      reps: 3,
      rounds: 4,
      every_s: 90,
      progression: { a: "Kip Swings avec hanches hautes + Chest-to-Bar explosifs (3 \xD7 5), trajet vers la barre", b: "Bar Muscle-Ups \xE9lastique ou saut\xE9s depuis une box basse, transition et dip (3 \xD7 3)" },
      substitutions: { scaled: "Banded Pull-Ups", inter: "Chest-to-Bar", rxplus: "Bar Muscle-ups", elite: "Ring Muscle-ups", pro: "Ring Muscle-ups" }
    }
  },
  {
    id: "skill_rmu",
    kind: "skill",
    movement: "ring_muscle_up",
    minutes: 15,
    skill: {
      reps: 3,
      rounds: 4,
      every_s: 90,
      progression: { a: "False grip Hang + Ring Rows en false grip (3 \xD7 8), anneaux vers le sternum", b: "Transitions pieds au sol sur anneaux bas puis Ring Dips profonds (3 \xD7 4)" },
      substitutions: { scaled: "Ring Rows false grip", inter: "Chest-to-Bar", rxplus: "Bar Muscle-ups", elite: "Ring Muscle-ups", pro: "Ring Muscle-ups" }
    }
  },
  {
    id: "skill_rope",
    kind: "skill",
    movement: "rope_climb",
    minutes: 15,
    skill: {
      reps: 2,
      rounds: 4,
      every_s: 90,
      progression: { a: "Verrouillage de pieds au sol (J-hook / S-wrap) et Rope Pulls assis \u2192 debout (3 \xD7 5)", b: "Mont\xE9es basses en 3 accroches avec pause \xE0 chaque verrouillage (3 \xD7 2)" },
      substitutions: { scaled: "Rope Pulls From Floor", inter: "Rope Climbs", rxplus: "Rope Climbs", elite: "Legless Rope Climbs", pro: "Legless Rope Climbs" }
    }
  },
  {
    id: "skill_wall_walk",
    kind: "skill",
    movement: "wall_walk",
    minutes: 15,
    skill: {
      reps: 4,
      rounds: 4,
      every_s: 90,
      progression: { a: "Plank Hold pieds au mur + Bear Crawl (3 \xD7 20 s), bassin rentr\xE9", b: "Half Wall Walks avec pause 3 s en haut (3 \xD7 3)" },
      substitutions: { scaled: "Half Wall Walks", inter: "Wall Walks", rxplus: "Wall Walks", elite: "Wall Walks + 5 Shoulder Taps", pro: "Wall Walks + 5 Shoulder Taps" }
    }
  },
  {
    id: "skill_hs_walk",
    kind: "skill",
    movement: "handstand_walk",
    minutes: 15,
    skill: {
      reps: 10,
      rounds: 4,
      every_s: 90,
      progression: { a: "Handstand Hold dos au mur (3 \xD7 30 s) puis Shoulder Taps (3 \xD7 10), doigts qui agrippent le sol", b: "D\xE9collages du mur : Handstand Walk 2-3 pas puis retour (3 \xD7 4 tentatives)" },
      substitutions: { scaled: "Handstand Shoulder Taps", inter: "Half Wall Walks", rxplus: "Handstand Walk", elite: "Handstand Walk", pro: "Handstand Walk" }
    }
  }
];
var fin = (id, family, movements, rounds = 3) => ({ id, family, rounds, minutes: 5, movements });
var mv = (id, qty, unit = "reps", name) => ({ id, qty, unit, ...name ? { name } : {} });
var FINISHERS = [
  // Tronc
  fin("core_hollow_plank", "core", [mv("hollow_rock", 15), mv("plank_hold", 30, "s")]),
  fin("core_sit_up_superman", "core", [mv("sit_up", 20), mv("superman", 20, "s")]),
  fin("core_ghd_hollow", "core", [mv("ghd_sit_up", 12), mv("hollow_hold", 30, "s")]),
  fin("core_dead_bug_side_plank", "core", [mv("dead_bug", 10, "reps", "Dead Bug (par c\xF4t\xE9)"), mv("side_plank", 20, "s", "Side Plank (par c\xF4t\xE9)")]),
  fin("core_t2b_l_sit", "core", [mv("toes_to_bar", 8), mv("l_sit", 15, "s", "L-Sit sur parallettes")]),
  fin("core_knee_raise_russian", "core", [mv("hanging_knee_raise", 12), mv("russian_twist", 20)]),
  fin("core_bear_crawl_hollow", "core", [mv("bear_crawl", 15, "m"), mv("hollow_hold", 20, "s")]),
  fin("core_ab_wheel_plank", "core", [mv("ab_wheel", 8), mv("plank_hold", 40, "s")]),
  // Carries
  fin("carry_farmer_lunge", "carry", [mv("db_farmer_carry", 50, "m"), mv("walking_lunge", 20)]),
  fin("carry_sandbag_bear_hug", "carry", [mv("sandbag_carry", 50, "m", "Sandbag Bear Hug Carry"), mv("air_squat", 10)]),
  fin("carry_suitcase_plank", "carry", [mv("suitcase_carry", 40, "m", "Suitcase Carry (par c\xF4t\xE9)"), mv("side_plank", 20, "s", "Side Plank (par c\xF4t\xE9)")]),
  fin("carry_overhead_kb", "carry", [mv("kb_overhead_carry", 30, "m", "KB Overhead Carry (par bras)"), mv("hollow_rock", 10)]),
  fin("carry_front_rack_db", "carry", [mv("db_front_rack_carry", 50, "m", "DB Front Rack Carry"), mv("sit_up", 15)]),
  // Épaules
  fin("shoulders_face_pull_raise", "shoulders", [mv("face_pull", 15, "reps", "Face Pull \xE9lastique"), mv("lateral_raise", 12, "reps", "Lateral Raise l\xE9ger")]),
  fin("shoulders_band_pull_apart_y", "shoulders", [mv("band_pull_apart", 20, "reps", "Band Pull-Aparts"), mv("db_y_raise", 10, "reps", "DB Y-Raise")]),
  fin("shoulders_ring_row_pushup", "shoulders", [mv("ring_row", 12), mv("push_up", 12)]),
  fin("shoulders_cuban_press_hold", "shoulders", [mv("cuban_press", 10, "reps", "Cuban Press l\xE9ger"), mv("handstand_shoulder_tap", 10)]),
  // Fessiers
  fin("glutes_bridge_clam", "glutes", [mv("glute_bridge", 15), mv("banded_clamshell", 15, "reps", "Banded Clamshells (par c\xF4t\xE9)")]),
  fin("glutes_hip_thrust_monster", "glutes", [mv("db_hip_thrust", 12), mv("monster_walk", 20, "m", "Monster Walk \xE9lastique")]),
  fin("glutes_kickback_swing", "glutes", [mv("glute_kickback", 12, "reps", "Glute Kickback \xE9lastique (par c\xF4t\xE9)"), mv("kb_swing_russian", 15)]),
  fin("glutes_single_leg_bridge_step_up", "glutes", [mv("single_leg_glute_bridge", 10, "reps", "Single-Leg Glute Bridge (par c\xF4t\xE9)"), mv("box_step_up", 16)]),
  // Mollets
  fin("calves_raise_jump", "calves", [mv("bodyweight_calf_raise", 20, "reps", "Calf Raises sur marche"), mv("double_under", 40)]),
  fin("calves_single_leg_hold", "calves", [mv("single_leg_calf_raise", 12, "reps", "Single-Leg Calf Raise (par c\xF4t\xE9)"), mv("calf_raise_hold", 20, "s", "Calf Raise Hold en haut")]),
  // Respiratoire
  fin("breathing_row_nasal", "breathing", [mv("row", 250, "m", "Row respiration nasale"), mv("box_breathing", 60, "s", "Box Breathing 4-4-4-4")], 2),
  fin("breathing_bike_exhale", "breathing", [mv("bike_erg", 300, "m", "Bike Erg facile"), mv("slow_exhale", 60, "s", "Respiration 4 s inspir / 8 s expir")], 2)
];
var S1_snatch = {
  id: "S1_snatch",
  discipline: "session",
  format: "session",
  track: "functional",
  day: 1,
  label: "Halt\xE9ro \xB7 Snatch",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 mobilit\xE9 \xE9paules et hanches, barre \xE0 vide : Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance en s\xE9rie de 5."] },
  block_a: S1_A,
  block_b: [B_OHS, B_SNATCH_BALANCE, B_STRICT_PULL_UP],
  block_c: { intentions: ["mixed", "gym"], durations: [12, 15, 20], pattern_not: "heavy_pattern" },
  finisher: FINISHERS
};
var S2_squat = {
  id: "S2_squat",
  discipline: "session",
  format: "session",
  track: "functional",
  day: 2,
  label: "Force \xB7 Squat",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 v\xE9lo ou rameur facile, mobilit\xE9 chevilles et hanches, Air Squats, Goblet Squats l\xE9gers, activation fessiers."] },
  block_a: S2_A,
  block_b: [B_PUSH_PRESS, B_STRICT_PRESS, B_RING_DIP, B_STRICT_PULL_UP],
  block_c: { intentions: ["cardio"], durations: [15, 20], pattern_not: "heavy_pattern" },
  finisher: FINISHERS
};
var S3_gym = {
  id: "S3_gym",
  discipline: "session",
  format: "session",
  track: "functional",
  day: 3,
  label: "Gym \xB7 Skill",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 mobilit\xE9 \xE9paules et poignets, Scap Pull-Ups, Kip Swings, Hollow / Arch, marche en HS contre le mur."] },
  block_a: S3_A,
  block_b: [B_RING_DIP, B_STRICT_HSPU, B_STRICT_PULL_UP],
  block_c: { intentions: ["gym", "mixed"], durations: [12, 15], formats: ["for_time", "amrap", "emom"], pattern_not: [] },
  finisher: FINISHERS
};
var S4_cj = {
  id: "S4_cj",
  discipline: "session",
  format: "session",
  track: "functional",
  day: 4,
  label: "Halt\xE9ro \xB7 Clean & Jerk",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 mobilit\xE9 poignets et hanches, barre \xE0 vide : Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk en s\xE9rie de 5."] },
  block_a: S4_A,
  block_b: [B_FRONT_SQUAT, B_PUSH_PRESS, B_STRICT_PULL_UP],
  block_c: { intentions: ["mixed"], durations: [15, 20], pattern_not: "heavy_pattern" },
  finisher: FINISHERS
};
var S5_hinge = {
  id: "S5_hinge",
  discipline: "session",
  format: "session",
  track: "functional",
  day: 5,
  label: "Force \xB7 Hinge",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 rameur facile, mobilit\xE9 ischios et hanches, Good Mornings barre \xE0 vide, Glute Bridges, Kettlebell Swings l\xE9gers."] },
  block_a: S5_A,
  block_b: [B_FRONT_RACK_LUNGE, B_STRICT_PRESS, B_GHD],
  block_c: { intentions: ["mixed", "cardio"], durations: [20, 30], formats: ["chipper", "stations"], pattern_not: "heavy_pattern" },
  finisher: null
};
var S6_long = {
  id: "S6_long",
  discipline: "session",
  format: "session",
  track: "functional",
  day: 6,
  label: "Long \xB7 Engine",
  budget_min: 60,
  warmup: { minutes: 18, lines: ["\xC9chauffement long (18') \u2014 3 tours faciles : 2' d'erg au choix, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats ; puis les mouvements du metcon \xE0 vide."] },
  block_a: null,
  block_b: null,
  block_c: { intentions: ["cardio", "mixed"], durations: [25, 30], pattern_not: [] },
  finisher: FINISHERS
};
var SESSION_SKELETONS = [S1_snatch, S2_squat, S3_gym, S4_cj, S5_hinge, S6_long];

// packages/wod-engine/src/bank/session-hybrid.ts
var HYBRID_FORBIDDEN_IDS = [
  // haltéro technique
  "power_snatch",
  "squat_snatch",
  "hang_power_snatch",
  "hang_squat_snatch",
  "muscle_snatch",
  "snatch_balance",
  "db_snatch",
  "kb_snatch",
  "power_clean",
  "squat_clean",
  "hang_power_clean",
  "hang_squat_clean",
  "muscle_clean",
  "clean_and_jerk",
  "db_clean_and_jerk",
  "kb_clean_and_jerk",
  "kb_clean",
  "sandbag_clean",
  "push_jerk",
  "split_jerk",
  "cluster",
  "thruster",
  "overhead_squat",
  "snatch_deadlift",
  "clean_deadlift",
  // gymnique avancé
  "bar_muscle_up",
  "ring_muscle_up",
  "handstand_push_up",
  "strict_handstand_push_up",
  "handstand_walk",
  "handstand_hold",
  "wall_walk",
  "half_wall_walk",
  "rope_climb",
  "legless_rope_climb",
  "pistol",
  "box_pistol",
  "pistol_to_box",
  "chest_to_bar",
  "bar_muscle_up_banded"
];
var HYBRID_JUMP_IDS = ["box_jump", "box_jump_over", "burpee_box_jump", "burpee_box_jump_over"];
var HYBRID_WEEKLY_JUMP_CAP = 60;
var HYBRID_WEEKLY_RUN_M = 12e3;
var HYBRID_FRIDAY_RUN_M = 3e3;
var HYBRID_HARD_RPE = 8;
var HYBRID_EASY_RPE = 6.5;
var HYBRID_TUESDAY_RPE = 7.5;
var HYBRID_FRIDAY_RPE = 7.5;
var item = (id, qty, unit, o = {}) => ({
  id,
  qty,
  unit,
  ...o.band ? { band: o.band } : {},
  ...o.name ? { name: o.name } : {},
  ...o.load_from ? { load_from: o.load_from } : {},
  ...o.work_s ? { work_s: o.work_s } : {}
});
var station = (id, movement, minutes, every_s, rounds, items, rpe) => ({ id, kind: "station", movement, minutes, rpe, station: { every_s, rounds, items } });
var fin2 = (id, family, minutes, rounds, movements) => ({ id, family, rounds, minutes, movements });
var mv2 = (id, qty, unit = "reps", name) => ({ id, qty, unit, ...name ? { name } : {} });
var CORE_FINISHERS = [
  // gainage
  fin2("h_core_plank_hollow", "core", 5, 3, [mv2("plank_hold", 40, "s"), mv2("hollow_rock", 15)]),
  fin2("h_core_sit_up_superman", "core", 5, 3, [mv2("sit_up", 20), mv2("superman", 30, "s")]),
  // gainage anti-rotation
  fin2("h_core_deadbug_side", "core", 5, 3, [mv2("dead_bug", 10), mv2("plank_hold", 30, "s", "Side Plank (par c\xF4t\xE9)")]),
  fin2("h_core_pallof", "core", 5, 3, [mv2("plank_hold", 30, "s", "Pallof Press tenu (par c\xF4t\xE9)"), mv2("hollow_rock", 15)]),
  // carries
  fin2("h_carry_suitcase", "carry", 5, 3, [mv2("suitcase_carry", 40, "m"), mv2("dead_bug", 10)]),
  fin2("h_carry_farmer_plank", "carry", 5, 3, [mv2("db_farmer_carry", 40, "m"), mv2("plank_hold", 30, "s")]),
  fin2("h_carry_sandbag", "carry", 5, 3, [mv2("sandbag_carry", 40, "m"), mv2("sit_up", 20)]),
  // chaîne postérieure
  fin2("h_post_hip_bridge", "glutes", 5, 3, [mv2("glute_bridge", 20), mv2("superman", 30, "s")]),
  fin2("h_post_rdl_bridge", "glutes", 5, 3, [mv2("bodyweight_single_leg_rdl", 10, "reps", "Single-Leg RDL poids du corps (par jambe)"), mv2("glute_bridge", 20)]),
  // mollets
  fin2("h_calves_raise", "calves", 5, 3, [mv2("bodyweight_calf_raise", 25), mv2("plank_hold", 30, "s")]),
  // respiratoire sur erg
  fin2("h_breath_row", "breathing", 5, 3, [mv2("row", 15, "cal", "Row en respiration nasale"), mv2("plank_hold", 30, "s")]),
  fin2("h_breath_ski", "breathing", 5, 3, [mv2("ski_erg", 15, "cal", "SkiErg facile, respiration nasale"), mv2("dead_bug", 10)]),
  fin2("h_breath_bike", "breathing", 5, 3, [mv2("bike_erg", 15, "cal", "Bike Erg facile, respiration nasale"), mv2("superman", 30, "s")]),
  // épaules et haut du dos
  fin2("h_shoulders_carry", "shoulders", 5, 3, [mv2("suitcase_carry", 40, "m", "Overhead Carry (par c\xF4t\xE9)"), mv2("push_up", 10)]),
  fin2("h_shoulders_pushup", "shoulders", 5, 3, [mv2("push_up", 15), mv2("plank_hold", 30, "s")]),
  // mollets, second choix
  fin2("h_calves_carry", "calves", 5, 3, [mv2("bodyweight_calf_raise", 25), mv2("db_farmer_carry", 40, "m")]),
  // gainage, troisième choix
  fin2("h_core_hollow_superman", "core", 5, 3, [mv2("hollow_rock", 20), mv2("superman", 40, "s")]),
  fin2("h_core_situp_plank", "core", 5, 3, [mv2("sit_up", 25), mv2("plank_hold", 40, "s")]),
  fin2("h_post_bridge_deadbug", "glutes", 5, 3, [mv2("glute_bridge", 25), mv2("dead_bug", 12)]),
  fin2("h_breath_row_long", "breathing", 5, 2, [mv2("row", 25, "cal", "Row facile, respiration nasale"), mv2("superman", 40, "s")])
];
var COOLDOWNS = [
  { minutes: 8, lines: [
    "Retour au calme (8') \u2014 600 m de footing tr\xE8s lent ou 5' de v\xE9lo facile, respiration nasale.",
    "\xC9tirements : ischios debout 45 s / jambe \xB7 fl\xE9chisseurs de hanche en fente 45 s / c\xF4t\xE9 \xB7 mollets au mur 45 s / jambe."
  ] },
  { minutes: 8, lines: [
    "Retour au calme (8') \u2014 5' de rameur tr\xE8s facile, \xE9paules rel\xE2ch\xE9es.",
    "\xC9tirements : cha\xEEne post\xE9rieure assis 45 s \xB7 pigeon 45 s / c\xF4t\xE9 \xB7 ouverture thoracique au mur 45 s / bras."
  ] },
  { minutes: 6, lines: [
    "Retour au calme (6') \u2014 400 m de marche rapide puis respiration 4-6 allong\xE9, 2'.",
    "\xC9tirements : quadriceps debout 45 s / jambe \xB7 adducteurs en grenouille 45 s \xB7 psoas en fente basse 45 s / c\xF4t\xE9."
  ] }
];
var H1_A = [
  station("h1_goblet_squat", "kb_goblet_squat", 18, 120, 8, [
    item("kb_goblet_squat", 12, "reps", { band: "medium" }),
    item("air_squat", 15, "reps")
  ], 7.5),
  station("h1_swing_step", "kb_swing_russian", 18, 120, 8, [
    item("kb_swing_russian", 15, "reps", { band: "medium" }),
    item("box_step_up", 10, "reps", { band: "medium", load_from: "db_farmer_carry", name: "Box Step-ups lest\xE9s (2 \xD7 DB)" })
  ], 7.5),
  station("h1_carry_pushup", "suitcase_carry", 18, 120, 8, [
    item("suitcase_carry", 40, "m"),
    item("push_up", 12, "reps")
  ], 7)
];
var H1_intervals = {
  id: "H1_intervals",
  discipline: "session",
  format: "session",
  track: "hybrid",
  day: 1,
  label: "Intervalles",
  budget_min: 60,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 \xD7 20 s skipping."] },
  block_a: H1_A,
  block_b: null,
  // `run_intervals` est exclu : le mercredi EST la séance d'intervalles de course, dans son
  // bloc A. Le lundi est « intervalles courts avec stations ».
  block_c: {
    intentions: ["interval", "engine", "run"],
    durations: [20],
    pattern_not: [],
    skeletons: ["amrap_distances", "stations_interval", "run_into_station", "compromised_run"]
  },
  finisher: CORE_FINISHERS
};
var H2_A = [
  station("h2_front_squat_carry", "front_squat", 20, 180, 5, [
    item("front_squat", 6, "reps", { band: "medium" }),
    item("db_farmer_carry", 20, "m", { band: "medium" })
  ], 7),
  station("h2_front_squat_sandbag", "front_squat", 20, 180, 5, [
    item("front_squat", 6, "reps", { band: "medium" }),
    item("sandbag_carry", 20, "m", { band: "medium" })
  ], 7),
  station("h2_goblet_carry", "kb_goblet_squat", 20, 180, 5, [
    item("kb_goblet_squat", 12, "reps", { band: "medium" }),
    item("db_farmer_carry", 20, "m", { band: "medium" })
  ], 7)
];
var H2_WORK = [
  {
    id: "h2_stations_erg_charge",
    kind: "station",
    movement: "row",
    minutes: 20,
    rpe: 7.5,
    station: {
      every_s: 90,
      rounds: 12,
      items: [
        item("row", 60, "s", { work_s: 60, name: "Row \u2014 allure tenable, ni sprint ni promenade" }),
        item("sandbag_lunge", 60, "s", { band: "medium", work_s: 60 }),
        item("ski_erg", 60, "s", { work_s: 60, name: "SkiErg \u2014 allure tenable" }),
        item("sandbag_carry", 60, "s", { band: "medium", work_s: 60 })
      ]
    }
  },
  {
    id: "h2_stations_bike_charge",
    kind: "station",
    movement: "bike_erg",
    minutes: 20,
    rpe: 7.5,
    station: {
      every_s: 90,
      rounds: 12,
      items: [
        item("bike_erg", 60, "s", { work_s: 60, name: "Bike Erg \u2014 allure tenable" }),
        item("wall_ball", 60, "s", { band: "medium", work_s: 60 }),
        item("ski_erg", 60, "s", { work_s: 60, name: "SkiErg \u2014 allure tenable" }),
        item("db_farmer_carry", 60, "s", { band: "medium", work_s: 60 })
      ]
    }
  }
];
var H2_strength_stations = {
  id: "H2_strength_stations",
  discipline: "session",
  format: "session",
  track: "hybrid",
  day: 2,
  label: "Force & stations",
  budget_min: 60,
  max_rpe: HYBRID_TUESDAY_RPE,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 500 m rameur facile, 10 hip hinges \xE0 la barre \xE0 vide, 10 fentes / jambe, 10 pompes, 20 m d'ours."] },
  block_a: H2_A,
  block_b: null,
  block_work: H2_WORK,
  block_c: null,
  finisher: CORE_FINISHERS
};
var H3_A = [{
  id: "h3_run_intervals",
  kind: "run",
  movement: "run",
  minutes: 30,
  rpe: 8.5,
  timed: true,
  run: {
    variants: [
      { label: "8 \xD7 400 m", target: "allure 5 km", rest_s: 60, meters: 3200 },
      { label: "5 \xD7 800 m", target: "allure 10 km \u2212 10 s/km", rest_s: 90, meters: 4e3 },
      { label: "3 \xD7 1 600 m", target: "allure 10 km", rest_s: 120, meters: 4800 },
      { label: "12 \xD7 200 m shuttle", target: "allure rapide et r\xE9guli\xE8re", rest_s: 45, meters: 2400 }
    ]
  }
}];
var H3_run = {
  id: "H3_run",
  discipline: "session",
  format: "session",
  track: "hybrid",
  day: 3,
  label: "Course",
  budget_min: 60,
  warmup: { minutes: 12, lines: ["\xC9chauffement (12') \u2014 1 km progressif, gammes (talons-fesses, mont\xE9es de genoux, pas chass\xE9s) 2 \xD7 20 m, 3 \xD7 30 m d'acc\xE9l\xE9rations."] },
  block_a: H3_A,
  block_b: null,
  /*
   * Aucun bloc tiré : `core_carry_finisher` est le seul squelette court de la banque
   * Hybrid, et ses carries sont déjà au mardi et au jeudi — les deux jours voisins.
   * Le tronc du mercredi passe donc en finisher, où la banque est large.
   */
  block_c: null,
  finisher: CORE_FINISHERS,
  // après des intervalles de course, la sortie lente fait partie de la séance
  cooldown: COOLDOWNS
};
var H4_engine = {
  id: "H4_engine",
  discipline: "session",
  format: "session",
  track: "hybrid",
  day: 4,
  label: "Engine",
  budget_min: 60,
  max_rpe: HYBRID_EASY_RPE,
  warmup: { minutes: 8, lines: ["\xC9chauffement (8') \u2014 400 m course facile, 10 air squats, 10 pompes, 5 inchworms."] },
  block_a: null,
  block_b: null,
  block_c: { intentions: ["aerobic"], durations: [35, 40], pattern_not: [], skeletons: ["engine_continuous", "engine_negative_split"] },
  finisher: null,
  cooldown: COOLDOWNS
};
var H5_A = [
  station("h5_sled_push_heavy", "sled_push", 12, 150, 5, [
    item("sled_push", 30, "m", { band: "heavy" }),
    item("run", 100, "m")
  ], HYBRID_FRIDAY_RPE),
  station("h5_sled_pull_heavy", "sled_pull", 12, 150, 5, [
    item("sled_pull", 30, "m", { band: "heavy" }),
    item("run", 100, "m")
  ], HYBRID_FRIDAY_RPE),
  station("h5_sandbag_heavy", "sandbag_carry", 12, 150, 5, [
    item("sandbag_carry", 50, "m", { band: "heavy" }),
    item("run", 100, "m")
  ], HYBRID_FRIDAY_RPE)
];
var H5_WORK = [{
  id: "h5_compromised_run",
  kind: "compromised",
  movement: "run",
  minutes: 28,
  rpe: HYBRID_FRIDAY_RPE,
  timed: false,
  compromised: {
    rounds: 4,
    work_s: 90,
    run_m_min: 600,
    run_m_max: 1e3,
    target: "allure 5 km + 15 s/km",
    // aucun poste en commun avec la simulation du samedi : les deux jours se suivent,
    // et un mouvement qui revient le lendemain est la répétition la plus visible
    stations: [
      item("box_step_up", 20, "reps", { band: "medium", load_from: "db_farmer_carry", name: "Box Step-ups lest\xE9s (2 \xD7 DB)", work_s: 90 }),
      item("box_jump", 15, "reps", { band: "medium", work_s: 90 }),
      item("burpee", 20, "reps", { work_s: 90 }),
      item("sandbag_carry", 40, "m", { band: "medium", work_s: 90 }),
      item("suitcase_carry", 40, "m", { work_s: 90 }),
      item("air_squat", 30, "reps", { work_s: 90 })
    ]
  }
}];
var H5_compromised = {
  id: "H5_compromised",
  discipline: "session",
  format: "session",
  track: "hybrid",
  day: 5,
  label: "Course compromise",
  budget_min: 60,
  max_rpe: HYBRID_FRIDAY_RPE,
  warmup: { minutes: 10, lines: ["\xC9chauffement (10') \u2014 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled \xE0 vide, 10 wall balls l\xE9g\xE8res."] },
  block_a: H5_A,
  block_b: null,
  block_work: H5_WORK,
  block_c: null,
  finisher: CORE_FINISHERS
};
var HALF_SIM_STATIONS = [
  item("ski_erg", 500, "m"),
  item("sled_push", 25, "m", { band: "medium" }),
  item("sled_pull", 25, "m", { band: "medium" }),
  item("burpee_broad_jump", 40, "m"),
  item("db_farmer_carry", 100, "m", { band: "medium" }),
  item("sandbag_lunge", 50, "m", { band: "medium" }),
  item("wall_ball", 50, "reps", { band: "medium" })
];
var H6_simulation = {
  id: "H6_simulation",
  discipline: "session",
  format: "session",
  track: "hybrid",
  day: 6,
  label: "Simulation",
  budget_min: 60,
  warmup: { minutes: 12, lines: ["\xC9chauffement (12') \u2014 1 km progressif, gammes, puis 20 m de chaque station \xE0 vide."] },
  block_a: null,
  block_b: null,
  block_work: [{
    id: "h6_half_sim",
    kind: "race",
    movement: "run",
    minutes: 38,
    timed: true,
    rpe: 9,
    race: { rounds: 7, rounds_min: 6, rounds_max: 8, run_m: 500, stations: HALF_SIM_STATIONS, score: "temps total" }
  }],
  block_c: null,
  finisher: null,
  cooldown: COOLDOWNS
};
var H6_simulation_full = {
  id: "H6_simulation_full",
  discipline: "session",
  format: "session",
  track: "hybrid",
  day: 6,
  label: "Simulation \xB7 test de bloc",
  budget_min: 75,
  weeks_modulo: { modulo: 8, equals: 0 },
  warmup: { minutes: 12, lines: ["\xC9chauffement (12') \u2014 1 km progressif, gammes, puis 20 m de chaque station \xE0 vide. Pr\xE9pare ton mat\xE9riel : la s\xE9ance s'encha\xEEne sans arr\xEAt."] },
  block_a: null,
  block_b: null,
  block_work: [{
    id: "h6_full_sim",
    kind: "race",
    movement: "run",
    minutes: 53,
    timed: true,
    rpe: 9,
    race: {
      rounds: 8,
      run_m: 1e3,
      score: "temps total",
      ordered: true,
      stations: [
        item("ski_erg", 1e3, "m"),
        item("sled_push", 50, "m", { band: "medium" }),
        item("sled_pull", 50, "m", { band: "medium" }),
        item("burpee_broad_jump", 80, "m"),
        item("row", 1e3, "m"),
        item("db_farmer_carry", 200, "m", { band: "medium" }),
        item("sandbag_lunge", 100, "m", { band: "medium" }),
        item("wall_ball", 100, "reps", { band: "medium" })
      ]
    }
  }],
  block_c: null,
  finisher: null,
  cooldown: COOLDOWNS
};
var HYBRID_SESSION_SKELETONS = [
  H1_intervals,
  H2_strength_stations,
  H3_run,
  H4_engine,
  H5_compromised,
  H6_simulation,
  H6_simulation_full
];

// packages/wod-engine/src/bank/index.ts
var BANK_VERSION = 4;
var MUSCU_BANK_VERSION = 2;
var FUNCTIONAL_SKELETONS = [
  couplet_for_time_21_15_9,
  triplet_for_time_classics,
  couplet_amrap_short,
  triplet_amrap_mid,
  triplet_rounds_for_time,
  chipper_descending,
  chipper_stations_erg,
  emom_alternating,
  interval_work_rest,
  ladder_ascending,
  ladder_finite,
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
  run_intervals,
  engine_negative_split
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
var FAMILY_CAP_FACTOR = {
  jump_rope: 4
};
function genericCapFor(caps, family, unit) {
  const base = caps[unit];
  return base === void 0 ? void 0 : base * (FAMILY_CAP_FACTOR[family] ?? 1);
}
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
  // Borne le haut de la corde à sauter : sans elle, le facteur de famille
  // laissait passer 300 à 400 double unders dans un WOD de rounds. Le plafond
  // de classe remplace le générique modulé (400 en RX) et le ramène à 200.
  { label: "corde \xE0 sauter", family: "jump_rope", unit: "reps", rx: 200 },
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
  session_skeletons: [...SESSION_SKELETONS, ...HYBRID_SESSION_SKELETONS]
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
    skeletons: metcon.map((r) => ({ ...r.definition.c2c3 ?? r.definition, id: r.id, discipline: r.discipline, format: r.format })),
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
var BAND_CADENCE_FACTOR = { light: 1, medium: 1.2, heavy: 1.5 };
function cadence(m, category) {
  const c = m.cadence_by_category[category];
  if (c === void 0) throw new Error(`cadence manquante : ${m.id} / ${category}`);
  return c * (m.load_band ? BAND_CADENCE_FACTOR[m.load_band] : 1);
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
      if (!block.ladder) {
        const s = fixedWorkSeconds(block, category);
        return { minutes: s / 60, target: `\u2248 ${fmtTime(s)}` };
      }
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
  const pair2 = discipline === "functional" ? m.loads_by_category.rx : [m.loads_by_category.men?.[0], m.loads_by_category.women?.[0]];
  if (!pair2 || pair2.some((v) => v === void 0 || v === null)) return null;
  const vals = pair2;
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
      return b.ladder ? [`Ladder ${b.ladder.start}-${b.ladder.start + b.ladder.step}-${b.ladder.start + 2 * b.ladder.step}\u2026 \xB7 AMRAP ${wod.budget_min}`, `Monter les paliers (+${b.ladder.step} \xE0 chaque palier) jusqu'au temps, score = reps totales`] : [`Ladder ${schemeText(b)} \xB7 for time${cap}`, "Effectuer une fois tous les paliers indiqu\xE9s"];
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
  const all = [...new Set(b.movements.filter((m) => m.round === void 0 || m.round === 1).map((m) => m.name))];
  const names = all.slice(0, 3);
  if (all.length > 3) names[2] = `${names[2]} +${all.length - 3}`;
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
    wod_type: b.format === "ladder" && !b.ladder ? "for-time" : WOD_TYPE[b.format],
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
var TOLERANCE = 0.2;
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
function durationRange(sk, variant, entry) {
  const [declaredMin, declaredMax] = variant?.duration_range ?? sk.duration_range ?? [Math.min(...sk.durations), Math.max(...sk.durations)];
  const min = entry === "after_class" ? Math.max(15, declaredMin) : declaredMin;
  const max = entry === "after_class" ? Math.min(20, declaredMax) : declaredMax;
  return min <= max ? [min, max] : null;
}
function candidatePool(ctx, params, bank, rng) {
  const banned = new Set((params.skeleton_not ?? []).map((id) => id.split(":")[0]));
  const all = bank.skeletons.filter((s) => s.discipline === params.discipline && !banned.has(s.id) && s.intentions.includes(params.intention) && durationRange(s, null, params.entry) !== null && (!ctx.afterClass && !ctx.exclude.size || (s.variants ?? [null]).some((variant) => durationRange(s, variant, params.entry) !== null && canComposeSlots(ctx, s, variant))));
  const choices = Object.keys(FORMAT_CHOICES).filter((choice2) => all.some((s) => FORMAT_CHOICES[choice2].includes(s.format)));
  const requested = params.format && params.format !== "surprise" ? params.format : null;
  if (requested && !choices.includes(requested)) return null;
  const choice = requested ?? (choices.length ? rng.pick(choices) : null);
  if (!choice) return null;
  const formats = FORMAT_CHOICES[choice].filter((format2) => all.some((s) => s.format === format2));
  if (!formats.length) return null;
  const format = rng.pick(formats);
  return all.filter((s) => s.format === format);
}
function canComposeSlots(ctx, sk, variant) {
  const source = variant?.slots ?? sk.slots;
  const rounds = variant?.rounds ?? sk.rounds;
  const rotations = typeof rounds === "object" && rounds.min >= 4 ? rounds.min : 1;
  const slots5 = source.flatMap((slot2, index) => slot2.rotate_per_round && rotations > 1 ? Array.from({ length: rotations }, (_, r) => ({ slot: slot2, index, round: r + 1 })) : [{ slot: slot2, index, round: void 0 }]);
  const band = effectiveBand(sk, ctx.params);
  const small = sk.discipline === "functional" && slots5.length <= 3;
  const pools = slots5.map(({ slot: slot2 }) => ctx.catalog.movements.filter((m) => matchesPick(ctx, slot2, m, [], sk, small) === null && !gymRecordMissing(ctx, m)));
  const visit = (index, picked) => {
    if (index === slots5.length) return !SLOT_INTENTIONS.has(ctx.params.intention) || picked.some((p) => carriesIntention(ctx.params, p.m, p.band, sk));
    const { slot: slot2, index: slotIndex, round } = slots5[index];
    if (slot2.optional && sk.station_count && picked.length >= (sk.station_count.min ?? slots5.length) && visit(index + 1, picked)) return true;
    return pools[index].some((m) => matchesPick(ctx, slot2, m, picked, sk, small) === null && visit(index + 1, [...picked, { m, slot: slot2, index: slotIndex, round, unit: pickUnit(slot2, m), band, qty: 1 }]));
  };
  return visit(0, []);
}
function candidateTiers(params, bank) {
  const banned = new Set((params.skeleton_not ?? []).map((id) => id.split(":")[0]));
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
var TIER_ATTEMPTS_EXPLICIT = 200;
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
  const repeatedRun = format === "continuous" && m.family === "run" && picked.at(-1)?.m.family !== "run";
  if (picked.some((q) => q.m.id === m.id) && !repeatedRun) return "duplicate";
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
var GYM_RECORD_FRACTION = 0.5;
function gymRecordMissing(ctx, m) {
  const rec = ctx.params.gym_records;
  if (!rec || m.family !== "gym") return false;
  const r = rec[m.id];
  return r !== void 0 && r <= 0;
}
function gymSubstitute(ctx, m) {
  let cur = m;
  for (let i = 0; i < 8 && gymRecordMissing(ctx, cur); i++) {
    const s = cur.substitutions;
    const nextId = [s?.rx, s?.inter, s?.scaled].find((id) => id && id !== cur.id) ?? null;
    const next = nextId ? movementById(ctx.catalog, nextId) : null;
    if (!next) break;
    cur = next;
  }
  return cur;
}
function gymDown(ctx, m, picked) {
  const s = m.substitutions;
  const nextId = [s?.rx, s?.inter, s?.scaled].find((id) => id && id !== m.id) ?? null;
  const next = nextId ? movementById(ctx.catalog, nextId) : null;
  if (!next || next.family !== m.family || picked.some((p) => p.m.id === next.id)) return null;
  return gymRecordMissing(ctx, next) ? gymDown(ctx, next, picked) : next;
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
  const seen = /* @__PURE__ */ new Set();
  for (const m of ctx.catalog.movements) {
    let use = resolve(m);
    if (!use) continue;
    const sub = gymSubstitute(ctx, use);
    if (gymRecordMissing(ctx, sub)) {
      reasons.gym_record = (reasons.gym_record ?? 0) + 1;
      continue;
    }
    if (sub !== use) {
      if (matchesPick(ctx, slot2, sub, picked, sk, functionalSmall) !== null) {
        reasons.gym_record = (reasons.gym_record ?? 0) + 1;
        continue;
      }
      use = sub;
    }
    if (need && !need(use)) {
      reasons.intention = (reasons.intention ?? 0) + 1;
      continue;
    }
    if (seen.has(use.id)) continue;
    seen.add(use.id);
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
      if (ctx.durationRange) {
        const [min, max] = ctx.durationRange;
        const durations = Array.from({ length: Math.floor(max) - Math.ceil(min) + 1 }, (_, i) => Math.ceil(min) + i).filter((duration) => within(est / 60, duration));
        if (durations.length) {
          ctx.params.budget_min = ctx.rng.pick(durations);
          return;
        }
      }
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
var HEAVY_STATION_REPS = [3, 5];
function capHeavyStationReps(ctx, d) {
  if (ctx.params.intention !== "force") return;
  const [lo, hi] = HEAVY_STATION_REPS;
  for (const p of d.picked) {
    if (p.band !== "heavy" || p.unit !== "reps" || !p.m.loads) continue;
    if (p.range && (p.range[0] > hi || p.range[1] < lo)) throw new Reject(`heavy_station_reps:${p.m.id}`);
    p.qty = Math.min(hi, Math.max(lo, p.qty));
  }
}
function fitEmom(ctx, d) {
  const every = typeof d.restSpec?.every_s === "number" ? d.restSpec.every_s : 60;
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
  const rest = d.restSpec ?? {};
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
function lastCarrierSlot(ctx, sk, slots5, band) {
  if (!SLOT_INTENTIONS.has(ctx.params.intention)) return -1;
  for (let i = slots5.length - 1; i >= 0; i--) {
    const p = slots5[i].pick;
    const slotBand = p.band ? constrainBand(p.band, ctx.params, sk) : band;
    const ok = ctx.catalog.movements.some((m) => m.active && weightFor(m, ctx.params.discipline) > 0 && (!p.ids || p.ids.includes(m.id)) && (!p.family || p.family.includes(m.family)) && (!p.modality || p.modality.includes(m.modality)) && (!p.pattern_any || m.pattern.some((x) => p.pattern_any.includes(x))) && (!p.pattern_not || !m.pattern.some((x) => p.pattern_not.includes(x))) && carriesIntention(ctx.params, m, slotBand, sk));
    if (ok) return i;
  }
  return -1;
}
function buildDraft(ctx, sk, variant = null) {
  const band = effectiveBand(sk, ctx.params);
  const slots5 = activeSlots(ctx, sk, variant);
  const format = sk.format;
  const functionalSmall = ctx.params.discipline === "functional" && slots5.length <= 3;
  const scheme = variant?.scheme ?? sk.scheme_by_band?.[band] ?? sk.scheme;
  const d = {
    sk,
    variantId: variant?.id ?? null,
    slots: slots5,
    band,
    picked: [],
    rounds: null,
    restSpec: variant?.rest ?? sk.rest
  };
  const roundsCandidates = pickRounds(ctx, sk, variant, band);
  const rounds = roundsCandidates[0] || null;
  const intentionMet = () => !SLOT_INTENTIONS.has(ctx.params.intention) || d.picked.some((p) => carriesIntention(ctx.params, p.m, p.band, sk));
  const lastCarrier = lastCarrierSlot(ctx, sk, slots5, band);
  slots5.forEach((slot2, index) => {
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
      capHeavyStationReps(ctx, d);
      break;
    case "interval":
      fitInterval(ctx, d, roundsCandidates);
      capHeavyStationReps(ctx, d);
      break;
    case "stations":
      fitStations(ctx, d);
      capHeavyStationReps(ctx, d);
      break;
    case "ladder":
      if (sk.ladder_mode === "finite") {
        fitFixedVolume(ctx, d, [1]);
        d.rounds = null;
      } else fitLadder(ctx, d);
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
  if (ctx.params.discipline === "functional" && (d.picked.length < 2 || d.picked.length > 5)) {
    throw new Reject("functional_movement_count");
  }
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
    const perWod = tabata ? 8 * 20 / (cadenceFor(p.m, ctx.ref, p.unit) ?? 1) : p.qty * mult;
    const specific = movementCapFor(ctx.bank, p.m, p.band, p.unit, ctx.ref);
    const rec = p.unit === "reps" ? ctx.params.gym_records?.[p.m.id] : void 0;
    if (rec && rec > 0 && !tabata) {
      const perSet = Math.max(1, Math.floor(rec * GYM_RECORD_FRACTION));
      const biggest = p.scheme ? Math.max(...p.scheme) : p.qty;
      if (biggest > perSet) {
        if (p.range && !p.scheme && perSet >= p.range[0]) {
          p.qty = perSet;
          changed = true;
          continue;
        }
        const alt = gymDown(ctx, p.m, d.picked);
        if (!alt) throw new Reject(`gym_record:${p.m.id}`);
        p.m = alt;
        if (p.range) p.range = rangeFor(ctx, p.slot, alt, p.unit, d.sk.format);
        changed = true;
        continue;
      }
    }
    const cap = specific ?? genericCapFor(caps, p.m.family, p.unit) ?? Infinity;
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
  const finiteLadder = d.sk.format === "ladder" && d.sk.ladder_mode === "finite";
  if ((!TIME_BOUNDED.has(d.sk.format) || finiteLadder) && !within(refEst.minutes, ctx.params.budget_min)) throw new Reject("duration_final");
  if (d.sk.format === "amrap") {
    const rounds = ctx.params.budget_min * 60 / roundSeconds(block, ctx.ref);
    if (rounds < 3 || rounds > 10) throw new Reject("amrap_round_length");
  }
  const timeBounded = !finiteLadder && TIME_BOUNDED.has(d.sk.format) || d.sk.format === "interval" || d.sk.score_type !== "time";
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
  if (ctx.params.round_qty) roundQuantities(block);
  const estimate = estimateAll({ ...partial, ...emptyEditor() });
  const wod = { ...emptyEditor(), ...partial, estimate, signature: "" };
  wod.signature = signature(wod);
  return render(wod);
}
function roundQuantities(block) {
  const step = (unit) => unit === "reps" || unit === "cal" ? 5 : unit === "s" ? 10 : 0;
  const snap = (q, s) => s ? Math.max(s, Math.round(q / s) * s) : q;
  for (const m of block.movements) {
    const s = step(m.unit);
    if (!s) continue;
    m.qty = snap(m.qty, s);
    if (m.scheme) m.scheme = m.scheme.map((q) => snap(q, s));
  }
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
  const initialBudget = params.budget_min ?? (params.entry === "after_class" ? 15 : 10);
  const normalized = { ...params, budget_min: initialBudget };
  const ctx = {
    params: normalized,
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
    const reachable = catalog.movements.some((m) => m.active && weightFor(m, params.discipline) > 0 && !ctx.subOnly.has(m.id) && carriesIntention(normalized, m, "light", probe) && !equipmentExcluded(ctx, m) && !m.pattern.some((x) => ctx.afterClass.patterns.has(x)) && !ctx.afterClass.families.has(m.family));
    if (!reachable) ctx.afterClass.intentionExempt = true;
  }
  const athlete = params.budget_min === void 0;
  const pool = athlete ? candidatePool(ctx, params, bank, rng) : null;
  const tiers = athlete ? [] : candidateTiers(normalized, bank);
  if (!pool && !tiers.length) throw new NoValidWod("Aucun squelette compatible", { no_skeleton: 1 });
  const recent = new Set(params.recent_signatures ?? []);
  const reasons = {};
  let tier = 0;
  let tierFails = 0;
  const explicit = !!params.format && params.format !== "surprise";
  const tierBudget = explicit ? TIER_ATTEMPTS_EXPLICIT : TIER_ATTEMPTS;
  const maxAttempts = athlete || !explicit ? MAX_ATTEMPTS : MAX_ATTEMPTS + TIER_ATTEMPTS_EXPLICIT;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!athlete && tierFails >= tierBudget && tier < tiers.length - 1) {
      tier++;
      tierFails = 0;
    }
    const list = pool ?? tiers[tier].list;
    const sk = rng.pick(list);
    const variants = sk.variants?.filter((v) => !athlete || durationRange(sk, v, params.entry) !== null && (!ctx.afterClass && !ctx.exclude.size || canComposeSlots(ctx, sk, v))) ?? [];
    const variant = variants.length ? rng.pick(variants) : null;
    const range = durationRange(sk, variant, params.entry);
    if (athlete && !range) continue;
    const budget = params.budget_min ?? rng.int(Math.ceil(range[0]), Math.floor(range[1]));
    ctx.params = { ...normalized, budget_min: budget };
    ctx.durationRange = athlete ? range : void 0;
    try {
      const d = buildDraft(ctx, sk, variant);
      const wod = finalize(ctx, d, athlete ? [] : tiers[tier].relaxations, attempt, seed);
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
  throw new NoValidWod(`Aucun WOD valide apr\xE8s ${maxAttempts} tirages`, reasons);
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
var MUSCU_TOLERANCE = 0.2;
var MUSCU_DURATIONS = { express: [20, 30, 45, 60], after_class: [15, 20, 30], tronc: [15, 20, 30] };
var BEGINNER_MAX_EXERCISES = 4;
var BEGINNER_MAX_EXERCISES_LONG = 6;
var BEGINNER_LONG_BUDGET_MIN = 45;
var MAX_EXERCISES = 6;
var HEAVY_MAX = 2;
var HEAVY_PERCENT = 80;
var DEMOTED_RANGE = [6, 8];
var DEMOTED_PERCENT_MAX = 75;
var REST_EXTRA_MAX = 15;
var BODYWEIGHT_MAX_LOADED = 1;
var CORE_MAX_OUTSIDE_TRONC = 1;
var BONUS_EXCLUDED_IDS = ["mountain_climber", "vacuum", "russian_twist"];
var HIGH_REP_SETS_MAX = 5;
var HIGH_REP_SETS_REPS_MAX = 15;
var PULL_UP_ENDURANCE_RANGE = [8, 12];
var BODYWEIGHT_PULL_UP_IDS = ["strict_pull_up", "chin_up", "wide_grip_pull_up", "neutral_grip_pull_up", "close_grip_pull_up"];
var NO_SQUAT_TARGETS = ["fessiers", "fessiers_ischios"];
var SQUAT_IDS = ["back_squat_m", "front_squat_m"];
var VOLUME_CAP_SETS = { hypertrophie: 12, force: 10, endurance: 9 };
var WEIGHTED_IDS = ["dips", "strict_pull_up", "chin_up", "wide_grip_pull_up", "neutral_grip_pull_up", "close_grip_pull_up", "close_grip_dips"];
var UNIT_RANGES = { s: [30, 60], m: [30, 50] };
var LOAD_STEP_KG = 2.5;
var WEIGHTED_BODYWEIGHT_RATIO = 0.1;
var TEMPO_311 = "3-1-1";
var TEMPO_311_SECONDS_PER_REP = 5;
var SCHEMES = {
  // Barème des repos : main = polyarticulaire principal, other = tout le reste.
  // Le rôle `core` (gainage) est à part et plafonné à 60 s (30 s en endurance),
  // voir `lineFor` : un gainage n'a pas besoin de deux minutes, et c'est ce
  // qu'un coach ferait. Validé par Nab le 18/09/2026 — une carte Tronc en
  // Prise de muscle affiche donc 60 s partout, ce n'est pas une anomalie.
  hypertrophie: { sets: { main: 4, other: 3 }, sets_min: 3, sets_max: 5, rest: { main: 90, other: 75 }, rpe: 8, rir: "derni\xE8re s\xE9rie \xE0 1-2 reps de l'\xE9chec" },
  force: { sets: { main: 5, other: 4 }, sets_min: 3, sets_max: 5, rest: { main: 150, other: 120 }, rpe: 8, rir: "RIR 2, derni\xE8re s\xE9rie RPE 9" },
  endurance: { sets: { main: 3, other: 3 }, sets_min: 2, sets_max: 5, rest: { main: 40, other: 40 }, rpe: 7, rir: "rythme continu, aucune s\xE9rie \xE0 l'\xE9chec" }
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
var OBJECTIVE_LABEL = { hypertrophie: "Prise de muscle", force: "Force", endurance: "Tonification" };
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
var PUSH_TARGETS = /* @__PURE__ */ new Set(["push", "pecs"]);
var PULL_TARGETS = /* @__PURE__ */ new Set(["pull", "dos"]);
var PUSH_PATTERNS = /* @__PURE__ */ new Set(["push_h", "push_v"]);
var PULL_PATTERNS = /* @__PURE__ */ new Set(["pull_h", "pull_v"]);
var REAR_DELT_PUSH_IDS = /* @__PURE__ */ new Set(["face_pull", "rear_delt_fly", "bent_over_lateral_raise", "rear_delt_machine"]);
function directionOk(target, m) {
  if (PUSH_TARGETS.has(target)) return REAR_DELT_PUSH_IDS.has(m.id) || !m.pattern.some((p) => PULL_PATTERNS.has(p));
  if (PULL_TARGETS.has(target)) return !m.pattern.some((p) => PUSH_PATTERNS.has(p));
  return true;
}
function basePool(ctx) {
  const { params } = ctx;
  const noSquat = NO_SQUAT_TARGETS.includes(params.target);
  const noBwPullUp = params.objective === "endurance" && params.level !== "avance";
  const troncMuscles = TARGET_MUSCLES.tronc;
  const minSets = SCHEMES[params.objective].sets_min;
  return ctx.catalog.movements.filter((m) => m.muscu).filter((m) => equipmentWeight(m, params.equipment) > 0 && levelOk(m, params.level) && !isExcluded2(ctx, m) && !ctx.excludedMuscles.has(m.muscu.muscle_primary) && directionOk(params.target, m) && weeklyRoomOk(ctx, m.muscu.muscle_primary, minSets) && !(noSquat && SQUAT_IDS.includes(m.id)) && !(noBwPullUp && BODYWEIGHT_PULL_UP_IDS.includes(m.id)) && !(params.target === "tronc" && m.muscu.compound && !troncMuscles.includes(m.muscu.muscle_primary)));
}
function isCoreMuscle(mu) {
  return TARGET_MUSCLES.tronc.includes(mu);
}
function isBodyweightNonCore(m) {
  return m.muscu.load_mode === "bodyweight" && !m.equipment.includes("band") && !isCoreMuscle(m.muscu.muscle_primary);
}
function isLoaded(m) {
  return m.muscu.load_mode !== "bodyweight" || m.equipment.includes("band");
}
function bodyweightAllowed(ctx, m, picked) {
  if (!isBodyweightNonCore(m)) return true;
  if (ctx.params.equipment === "none" || ctx.params.level === "debutant") return true;
  if (!loadedFor(ctx, m)) return true;
  const reserved = TARGET_MUSCLES[ctx.params.target].some((mu) => ctx.pool.some((x) => x.muscu.muscle_primary === mu) && !ctx.pool.some((x) => x.muscu.muscle_primary === mu && isLoaded(x)));
  if (reserved) return false;
  return picked.filter((p) => isBodyweightNonCore(p.m)).length < BODYWEIGHT_MAX_LOADED;
}
function loadedFor(ctx, m) {
  return ctx.pool.some((x) => x.muscu.muscle_primary === m.muscu.muscle_primary && isLoaded(x));
}
function coreAllowed(ctx, m, picked) {
  if (ctx.params.target === "tronc" || !isCoreMuscle(m.muscu.muscle_primary)) return true;
  return picked.filter((p) => isCoreMuscle(p.m.muscu.muscle_primary)).length < CORE_MAX_OUTSIDE_TRONC;
}
function weeklyRoomOk(ctx, mu, minSets) {
  if (muscleCap(ctx, mu) >= minSets) return true;
  ctx.relax.add("weekly_cap");
  return false;
}
function muscleCap(ctx, mu) {
  const room = ctx.params.weekly_room?.[mu];
  return room === void 0 ? VOLUME_CAP_SETS[ctx.params.objective] : Math.min(VOLUME_CAP_SETS[ctx.params.objective], room);
}
function groupAllowed(ctx, m, slot2, picked) {
  if (ctx.params.target === "full_body" || slot2.role === "core") return true;
  const same = picked.filter((p) => p.role !== "core" && p.m.muscu.movement_group === m.muscu.movement_group);
  if (!same.length) return true;
  return !!slot2.pair && !m.muscu.compound && same.length === 1 && same[0].m.muscu.compound;
}
var COMPOUND_ROLES = /* @__PURE__ */ new Set(["main_compound", "secondary_compound"]);
function roleOk(m, role) {
  if (role === "core" || role === "calves") return true;
  return COMPOUND_ROLES.has(role) ? m.muscu.compound : !m.muscu.compound;
}
function weekAllowed(ctx, m, slot2) {
  const seen = ctx.params.week_seen;
  const day = ctx.params.week_day;
  if (!seen?.length || day == null) return true;
  const memes = seen.filter((s) => s.id === m.id || s.group === m.muscu.movement_group);
  if (memes.length === 0) return true;
  if (memes.length > 1) return false;
  const [autre] = memes;
  if (Math.abs(autre.day - day) <= 1) return false;
  return autre.role !== slot2.role;
}
function candidates(ctx, slot2, f, picked, prevMuscle) {
  const used = new Set(picked.map((p) => p.m.id));
  const mainMuscles = new Set(picked.filter((p) => p.role === "main_compound").map((p) => p.m.muscu.muscle_primary));
  const requireUnilateral = f.unilateral && !!slot2.unilateral && ctx.params.level !== "debutant";
  return ctx.pool.filter((m) => {
    if (used.has(m.id)) return false;
    if (slot2.role !== "isolation" && PUSH_TARGETS.has(ctx.params.target) && REAR_DELT_PUSH_IDS.has(m.id)) return false;
    if (!f.muscles.includes(m.muscu.muscle_primary)) return false;
    if (prevMuscle && !(f.ids && slot2.groups) && m.muscu.muscle_primary === prevMuscle) return false;
    if (slot2.exclude_ids?.includes(m.id)) return false;
    if (f.ids && slot2.ids && !slot2.ids.includes(m.id)) return false;
    if (f.ids && slot2.groups && !slot2.groups.includes(m.muscu.movement_group)) return false;
    if (requireUnilateral && !m.muscu.unilateral) return false;
    if (f.role && !roleOk(m, slot2.role)) return false;
    if (f.objective && !objectiveFor(m, ctx.params.objective)) return false;
    if (slot2.role === "main_compound" && ctx.params.objective === "force" && !(f.ids && slot2.groups) && mainMuscles.has(m.muscu.muscle_primary)) return false;
    if (f.week && !weekAllowed(ctx, m, slot2)) return false;
    if (!groupAllowed(ctx, m, slot2, picked)) return false;
    if (!bodyweightAllowed(ctx, m, picked)) return false;
    if (!coreAllowed(ctx, m, picked)) return false;
    return true;
  });
}
var REPEAT_PENALTY = 4;
function priorityFor(m, equipment) {
  return equipment === "none" ? m.muscu.priority_bodyweight ?? m.muscu.priority : m.muscu.priority;
}
var PRIORITY_RANKS = { none: 3, box: 3, gym: 3 };
var FALLBACK_PRIORITY = 4;
function isFallback(ctx, m) {
  return ctx.params.equipment !== "none" && m.muscu.load_mode === "bodyweight" && m.muscu.priority >= FALLBACK_PRIORITY;
}
function preferLoaded(ctx, list) {
  const mieux = list.filter((m) => !isFallback(ctx, m));
  return mieux.length ? mieux : list;
}
function choose(ctx, list, role) {
  const sansMateriel = ctx.params.equipment === "none";
  if (role === "main_compound") {
    const rangs = [...new Set(list.map((m) => priorityFor(m, ctx.params.equipment)))].sort((a, b) => a - b);
    const gardees = new Set(rangs.slice(0, PRIORITY_RANKS[ctx.params.equipment]));
    list = list.filter((m) => gardees.has(priorityFor(m, ctx.params.equipment)));
  }
  const recents = sansMateriel ? new Set(ctx.params.recent_exercise_ids ?? []) : /* @__PURE__ */ new Set();
  return ctx.rng.pickWeighted(list, (x) => {
    const w = equipmentWeight(x, ctx.params.equipment);
    return recents.has(x.id) ? w / REPEAT_PENALTY : w;
  });
}
function pickSlot(ctx, slot2, index, picked, target) {
  const slotMuscles = Array.isArray(slot2.muscle) ? slot2.muscle : [slot2.muscle];
  const prev = picked.length ? picked[picked.length - 1].m.muscu.muscle_primary : null;
  const steps = [
    [null, { ids: true, unilateral: true, role: true, objective: true, muscles: slotMuscles, week: true }],
    ["semaine", { ids: true, unilateral: true, role: true, objective: true, muscles: slotMuscles, week: false }],
    // geste imposé (M4) : on garde le groupe avant de lâcher l'objectif ou le rôle
    [slot2.groups ? "slot_objective" : null, { ids: true, unilateral: true, role: true, objective: false, muscles: slotMuscles, week: false }],
    [slot2.groups ? "slot_role" : null, { ids: true, unilateral: true, role: false, objective: false, muscles: slotMuscles, week: false }],
    [slot2.ids || slot2.groups ? "slot_ids" : null, { ids: false, unilateral: true, role: true, objective: true, muscles: slotMuscles, week: false }],
    [slot2.unilateral ? "slot_unilateral" : null, { ids: false, unilateral: false, role: true, objective: true, muscles: slotMuscles, week: false }],
    ["slot_role", { ids: false, unilateral: false, role: false, objective: true, muscles: slotMuscles, week: false }],
    ["slot_objective", { ids: false, unilateral: false, role: false, objective: false, muscles: slotMuscles, week: false }]
  ];
  if (!slot2.optional) {
    const wider = TARGET_MUSCLES[target].filter((mu) => !slotMuscles.includes(mu) && !ctx.excludedMuscles.has(mu));
    if (wider.length) steps.push(["slot_muscle", { ids: false, unilateral: false, role: true, objective: true, muscles: wider, week: false }]);
    if (wider.length) steps.push(["slot_muscle", { ids: false, unilateral: false, role: false, objective: false, muscles: wider, week: false }]);
  }
  for (const [i, [relax, f]] of steps.entries()) {
    if (i > 0 && relax === null) continue;
    const tous = candidates(ctx, slot2, f, picked, prev);
    const list = i === 0 ? tous.filter((m2) => !isFallback(ctx, m2)) : preferLoaded(ctx, tous);
    if (!list.length) continue;
    const m = choose(ctx, list, slot2.role);
    if (relax && relax !== "semaine") ctx.relax.add(relax);
    if (i > 0 && !weekAllowed(ctx, m, slot2)) ctx.relax.add(`semaine:${m.id}`);
    const required = !!slot2.groups && f.ids && !slot2.optional;
    return { m, role: slot2.role, objective: objectiveFor(m, ctx.params.objective) ?? "hypertrophie", optional: !!slot2.optional, slotIndex: index, ...required ? { required } : {} };
  }
  return null;
}
function applyHeavyCap(ctx, picked) {
  if (ctx.params.objective !== "force") return;
  let heavy = 0;
  for (const p of picked) {
    if (p.objective !== "force") continue;
    heavy++;
    if (heavy <= HEAVY_MAX) continue;
    if (heavy === HEAVY_MAX + 1) {
      p.demoted = true;
      ctx.relax.add("heavy_cap");
      continue;
    }
    p.objective = "hypertrophie";
    ctx.relax.add("heavy_cap");
  }
}
function repRange(m, objective) {
  if (m.muscu.unit !== "reps") return UNIT_RANGES[m.muscu.unit];
  if (objective === "endurance" && BODYWEIGHT_PULL_UP_IDS.includes(m.id)) return [...PULL_UP_ENDURANCE_RANGE];
  const r = m.muscu.rep_ranges[objective] ?? m.muscu.rep_ranges.hypertrophie ?? Object.values(m.muscu.rep_ranges)[0];
  return r ? [r[0], r[1]] : [8, 12];
}
function lineFor(ctx, p) {
  const scheme = SCHEMES[p.objective];
  const kind = p.role === "main_compound" && !p.demoted ? "main" : "other";
  const range = p.demoted ? DEMOTED_RANGE : repRange(p.m, p.objective);
  const sets = p.role === "core" || p.role === "calves" ? Math.min(scheme.sets.other, 3) : scheme.sets[kind];
  const rest = p.role === "core" ? Math.min(scheme.rest.other, p.objective === "endurance" ? 30 : 60) : p.role === "calves" ? Math.min(scheme.rest.other, 45) : scheme.rest[kind];
  const tempo = ctx.params.equipment === "none" && ctx.params.objective === "hypertrophie" && p.m.muscu.load_mode === "bodyweight" && p.m.muscu.unit === "reps" && p.m.muscu.compound ? TEMPO_311 : void 0;
  return { ...p, sets, reps: Math.round((range[0] + range[1]) / 2), range, rest, rest0: rest, ...tempo ? { tempo } : {} };
}
function sessionSeconds(lines) {
  return lines.reduce((acc, l) => {
    const spr = l.tempo ? Math.max(l.m.muscu.seconds_per_rep, TEMPO_311_SECONDS_PER_REP) : l.m.muscu.seconds_per_rep;
    return acc + l.m.muscu.setup_s + l.sets * (l.reps * spr * (l.m.muscu.unilateral ? 2 : 1) + l.rest);
  }, 0);
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
      const bw = params.bodyweight_kg;
      return bw && bw > 0 ? { mode: "weighted", kg: roundLoad(bw * WEIGHTED_BODYWEIGHT_RATIO), rpe: scheme.rpe } : { mode: "weighted", rpe: scheme.rpe };
    }
    return l.m.equipment.includes("band") ? { mode: "bodyweight", band: true } : { mode: "bodyweight" };
  }
  if (mu.load_mode === "1rm" && mu.rm_reference) {
    const rm = params.one_rep_max?.[mu.rm_reference];
    const percent = l.demoted ? Math.min(percentForReps(l.reps), DEMOTED_PERCENT_MAX) : percentForReps(l.reps);
    if (params.box_wod && params.level !== "debutant") {
      return { mode: "percent", percent, rpe: scheme.rpe, rm_reference: mu.rm_reference };
    }
    if (rm && rm > 0 && params.level !== "debutant") {
      return { mode: "1rm", kg: roundLoad(rm * (mu.rm_factor ?? 1) * (percent / 100)), percent, rm_reference: mu.rm_reference };
    }
    return { mode: "rpe", rpe: params.level === "debutant" ? 7 : scheme.rpe, percent, rm_reference: mu.rm_reference };
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
  const out = [];
  const v = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const mu = l.m.muscu.muscle_primary;
    const room = muscleCap(ctx, mu) - (v.get(mu) ?? 0);
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
    const swappable = (l, k) => k > i && l.m.muscu.muscle_primary !== out[i - 1].m.muscu.muscle_primary && (k + 1 >= out.length || out[k + 1].m.muscu.muscle_primary !== out[i].m.muscu.muscle_primary);
    let j = out.findIndex((l, k) => swappable(l, k) && l.role === out[i].role);
    if (j < 0) j = out.findIndex((l, k) => swappable(l, k) && l.role !== "core");
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
function bonusIndex(lines, muscle) {
  for (let i = lines.length; i >= 1; i--) {
    if (lines[i - 1].m.muscu.muscle_primary === muscle) continue;
    if (i < lines.length && lines[i].m.muscu.muscle_primary === muscle) continue;
    return i;
  }
  return -1;
}
function bonusExercise(ctx, lines, target) {
  const used = new Set(lines.map((l) => l.m.id));
  const vol = volumeByMuscle(lines);
  const minSets = SCHEMES[ctx.params.objective].sets_min;
  const room = (mu) => muscleCap(ctx, mu) - (vol.get(mu) ?? 0);
  const muscles = TARGET_MUSCLES[target].filter((mu) => !ctx.excludedMuscles.has(mu) && room(mu) >= minSets);
  const bonusSlot = { role: "isolation", muscle: TARGET_MUSCLES[target], optional: true, pair: true };
  const eligible = (m2, anyObjective = false) => !used.has(m2.id) && bonusIndex(lines, m2.muscu.muscle_primary) >= 0 && !ctx.excludedMuscles.has(m2.muscu.muscle_primary) && room(m2.muscu.muscle_primary) >= minSets && (anyObjective || objectiveFor(m2, ctx.params.objective)) && !(ctx.params.objective !== "endurance" && BONUS_EXCLUDED_IDS.includes(m2.id)) && groupAllowed(ctx, m2, { ...bonusSlot, role: m2.muscu.compound ? "secondary_compound" : isCoreMuscle(m2.muscu.muscle_primary) ? "core" : "isolation" }, lines) && bodyweightAllowed(ctx, m2, lines) && coreAllowed(ctx, m2, lines) && weekAllowed(ctx, m2, { ...bonusSlot, role: m2.muscu.compound ? "secondary_compound" : isCoreMuscle(m2.muscu.muscle_primary) ? "core" : "isolation" });
  const targetMuscles = TARGET_MUSCLES[target];
  const primary = ctx.pool.filter((m2) => eligible(m2) && muscles.includes(m2.muscu.muscle_primary));
  const secondaryOf = (ms) => new Set(ms.flatMap((m2) => m2.muscu.muscle_secondary).filter((mu) => !isCoreMuscle(mu)));
  const fromLines = secondaryOf(lines.map((l) => l.m).filter((m2) => targetMuscles.includes(m2.muscu.muscle_primary)));
  const fromPool = secondaryOf(ctx.pool.filter((m2) => targetMuscles.includes(m2.muscu.muscle_primary)));
  const isSecondaryIso = (m2, set) => eligible(m2) && !m2.muscu.compound && !isCoreMuscle(m2.muscu.muscle_primary) && (set.has(m2.muscu.muscle_primary) || m2.muscu.muscle_secondary.some((mu) => targetMuscles.includes(mu)));
  let secondary = primary.length ? [] : ctx.pool.filter((m2) => isSecondaryIso(m2, fromLines));
  if (!primary.length && !secondary.length) secondary = ctx.pool.filter((m2) => isSecondaryIso(m2, fromPool));
  const tertiary = primary.length || secondary.length ? [] : ctx.pool.filter((m2) => eligible(m2, true) && isCoreMuscle(m2.muscu.muscle_primary) && (!m2.muscu.compound || m2.muscu.movement_group === "carry"));
  const base = primary.length ? primary : secondary.length ? secondary : tertiary;
  const iso2 = base.filter((m2) => !m2.muscu.compound);
  const m = choose(ctx, preferLoaded(ctx, iso2.length ? iso2 : base), "isolation");
  if (!m) return null;
  const role = isCoreMuscle(m.muscu.muscle_primary) ? "core" : m.muscu.compound ? "secondary_compound" : "isolation";
  const p = { m, role, objective: objectiveFor(m, ctx.params.objective) ?? (m.muscu.objectives.includes("hypertrophie") ? "hypertrophie" : m.muscu.objectives[0] ?? "hypertrophie"), optional: true, slotIndex: 99 };
  if (ctx.params.objective === "force" && p.objective === "force") p.objective = "hypertrophie";
  const line = lineFor(ctx, p);
  line.sets = Math.min(line.sets, room(m.muscu.muscle_primary));
  return line;
}
function fitBudget(ctx, input, target) {
  const budget = ctx.params.budget_min * 60;
  const lo = budget * (1 - MUSCU_TOLERANCE);
  const hi = budget * (1 + MUSCU_TOLERANCE);
  const maxEx = ctx.params.level === "debutant" ? ctx.params.budget_min >= BEGINNER_LONG_BUDGET_MIN ? BEGINNER_MAX_EXERCISES_LONG : BEGINNER_MAX_EXERCISES : MAX_EXERCISES;
  let lines = [...input];
  const joins = (i) => i > 0 && i + 1 < lines.length && lines[i - 1].m.muscu.muscle_primary === lines[i + 1].m.muscu.muscle_primary;
  const dropOptional = () => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].optional && !joins(i)) {
      lines.splice(i, 1);
      return true;
    }
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].optional) {
      lines.splice(i, 1);
      return true;
    }
    return false;
  };
  const dropLast = () => {
    if (lines.length <= 2) return false;
    for (let i = lines.length - 1; i > 0; i--) if (!lines[i].required && !joins(i)) {
      lines.splice(i, 1);
      return true;
    }
    for (let i = lines.length - 1; i > 0; i--) if (!lines[i].required) {
      lines.splice(i, 1);
      return true;
    }
    lines.splice(lines.length - 1, 1);
    return true;
  };
  while (lines.length > maxEx && (dropOptional() || dropLast())) ctx.relax.add("beginner_max");
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
    if (dropLast()) {
      ctx.relax.add("slots_dropped");
      continue;
    }
    ctx.relax.add("budget_long");
    break;
  }
  let guard = 0;
  while (total(lines) < lo && guard++ < 40) {
    if (lines.length < maxEx) {
      const bonus = bonusExercise(ctx, lines, target);
      if (bonus) {
        const at = bonusIndex(lines, bonus.m.muscu.muscle_primary);
        if (total([...lines, bonus]) <= hi) {
          lines.splice(at, 0, bonus);
          ctx.relax.add("bonus_slot");
          continue;
        }
        bonus.reps = bonus.range[0];
        if (total([...lines, bonus]) <= hi) {
          lines.splice(at, 0, bonus);
          ctx.relax.add("bonus_slot");
          continue;
        }
      }
    }
    const vol = volumeByMuscle(lines);
    const addable = lines.filter((l) => l.sets < SCHEMES[l.objective].sets_max && (vol.get(l.m.muscu.muscle_primary) ?? 0) < muscleCap(ctx, l.m.muscu.muscle_primary)).sort((a, b) => a.sets - b.sets || a.slotIndex - b.slotIndex);
    const fits = (l) => {
      const reps = l.reps;
      l.sets++;
      if (l.sets >= HIGH_REP_SETS_MAX && l.m.muscu.unit === "reps") l.reps = Math.min(l.reps, Math.max(l.range[0], HIGH_REP_SETS_REPS_MAX));
      if (total(lines) <= hi) return true;
      l.sets--;
      l.reps = reps;
      return false;
    };
    if (addable.some(fits)) continue;
    const tempoable = lines.filter((l) => !l.tempo && !l.demoted && l.objective !== "force" && l.m.muscu.unit === "reps" && l.m.muscu.seconds_per_rep < TEMPO_311_SECONDS_PER_REP).sort((a, b) => a.slotIndex - b.slotIndex);
    const slow = (l) => {
      l.tempo = TEMPO_311;
      if (total(lines) <= hi) return true;
      delete l.tempo;
      return false;
    };
    if (tempoable.some(slow)) {
      ctx.relax.add("tempo_311");
      continue;
    }
    const maxReps = (l) => l.sets >= HIGH_REP_SETS_MAX && l.m.muscu.unit === "reps" ? Math.min(l.range[1], Math.max(l.range[0], HIGH_REP_SETS_REPS_MAX)) : l.range[1];
    const underReps = lines.filter((l) => l.reps < maxReps(l));
    if (underReps.length) {
      for (const l of underReps) l.reps = Math.min(maxReps(l), l.reps + (l.range[1] - l.range[0] >= 4 ? 2 : 1));
      continue;
    }
    const restable = lines.filter((l) => l.rest < l.rest0 + REST_EXTRA_MAX);
    if (restable.length) {
      const before = restable.map((l) => l.rest);
      for (const l of restable) l.rest = l.rest0 + REST_EXTRA_MAX;
      if (total(lines) <= hi) {
        ctx.relax.add("rest_plus_15");
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
  if (l.demoted) parts.push("3e compound : 70-75 % \xD7 6-8");
  if (load.mode === "bodyweight" && ctx.params.level === "debutant" && /pull_up|chin_up/.test(l.m.id) && !/banded/.test(l.m.id)) parts.push("D\xE9butant : banded");
  if (l.tempo) parts.push(`tempo ${l.tempo}`);
  return parts.join(" \xB7 ");
}
function toExercise(ctx, l) {
  const load = loadFor(ctx, l);
  return {
    id: l.m.id,
    name: l.m.name,
    role: l.role,
    muscle_primary: l.m.muscu.muscle_primary,
    movement_group: l.m.muscu.movement_group,
    priority: l.m.muscu.priority,
    sets: l.sets,
    reps: l.reps,
    reps_unit: l.m.muscu.unit,
    per_side: l.m.muscu.unilateral,
    load,
    rest_s: l.rest,
    notes: notesFor(ctx, l, load),
    badge_key: l.m.badge_key,
    optional: l.optional
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
  applyHeavyCap(ctx, picked);
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
var DURATION_PROBE_SEEDS = 5;
function availableDurations(catalog, bank, params) {
  const all = params.target === "tronc" ? MUSCU_DURATIONS.tronc : params.entry === "after_class" ? MUSCU_DURATIONS.after_class : MUSCU_DURATIONS.express;
  return all.filter((budget_min) => {
    for (let seed = 1; seed <= DURATION_PROBE_SEEDS; seed++) {
      try {
        if (generateMuscu({ ...params, budget_min }, catalog, bank, seed).generator.relaxations.includes("budget_short")) return false;
      } catch {
        return false;
      }
    }
    return true;
  });
}
function generateMuscu(request, catalog, bank, seed) {
  const params = {
    ...request,
    budget_min: request.budget_min ?? (request.entry === "express" ? 45 : new RNG(seed).int(15, 20))
  };
  if (params.objective === "force" && params.entry === "after_class") {
    throw new InvalidMuscuParams("force_after_class", "Apr\xE8s ma classe : la Force n'est pas propos\xE9e (hypertrophie ou endurance)");
  }
  if (params.objective === "force" && params.equipment === "none") {
    throw new InvalidMuscuParams("force_without_equipment", "Sans mat\xE9riel : la Force est indisponible");
  }
  if (params.target === "tronc" && params.objective === "force") {
    throw new InvalidMuscuParams("force_tronc", "Tronc : la Force n'est pas propos\xE9e (Prise de muscle ou Tonification)");
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
      return l.kg ? `lest\xE9 ${l.kg} kg, RPE ${l.rpe}` : `lest\xE9 l\xE9ger, RPE ${l.rpe}`;
    case "bodyweight":
      return l.band ? "\xE9lastique" : e.reps_unit === "reps" ? "poids du corps" : "\u2014";
    default:
      return l.percent ? `RPE ${l.rpe} (\u2248 ${l.percent} % du 1RM)` : `RPE ${l.rpe}`;
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
    out += ` \u2014 RPE ${l.rpe} (\u2248 ${l.percent} % du 1RM)`;
  } else if (l.mode === "weighted") {
    out += l.kg ? ` \u2014 lest\xE9 ${l.kg} kg (10 % du poids de corps), RPE ${l.rpe}` : ` \u2014 lest\xE9 l\xE9ger, RPE ${l.rpe}`;
  } else if (l.mode === "rpe") {
    out += l.percent ? ` \u2014 charge RPE ${l.rpe} (\u2248 ${l.percent} % du 1RM)` : ` \u2014 charge RPE ${l.rpe}`;
  } else if (l.band) {
    out += " \u2014 charge \xE9lastique";
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
var SESSION_TOLERANCE = 0.2;
var TRANSITION_MIN = 1;
var SKILL_STEP_S = 180;
var B_RETRY_MAX = 12;
var FINISHER_SIGNATURE_PREFIX = "finisher:";
function finisherSignature(id) {
  return `${FINISHER_SIGNATURE_PREFIX}${id}`;
}
function splitSignatures(all) {
  const c = [];
  const finishers = [];
  for (const s of all) {
    if (s.startsWith(FINISHER_SIGNATURE_PREFIX)) finishers.push(s.slice(FINISHER_SIGNATURE_PREFIX.length));
    else c.push(s);
  }
  return { c, finishers };
}
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
var NL = "\n";
var CAT_LABEL = { scaled: "Scaled", inter: "Inter", rx: "RX", rxplus: "RX+", elite: "Elite", pro: "Pro" };
function withSkillProgression(opt) {
  if (!opt.skill || opt.skill.progression) return opt;
  const snapshot = SESSION_SKELETONS.flatMap((s) => s.block_a ?? []).find((o) => o.id === opt.id)?.skill?.progression;
  if (!snapshot) {
    throw new Error(`Skill \xAB ${opt.id} \xBB (${opt.movement}) sans progression A/B : absente de la banque charg\xE9e et du snapshot embarqu\xE9`);
  }
  return { ...opt, skill: { ...opt.skill, progression: snapshot } };
}
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
    lines.push(`\xC9tape A : ${sk.progression.a} \u2014 ${fmtEvery(SKILL_STEP_S)}`);
    lines.push(`\xC9tape B : ${sk.progression.b} \u2014 ${fmtEvery(SKILL_STEP_S)}`);
    lines.push(`\xC9tape C : Every ${fmtEvery(sk.every_s)} \xD7 ${sk.rounds}`);
    lines.push(`${sk.reps} ${name}`);
    const subs = Object.entries(sk.substitutions).map(([c, s]) => `${CAT_LABEL[c] ?? c} : ${s}`);
    if (subs.length) lines.push(`\u2192 ${subs.join(" \xB7 ")}`);
  }
  return lines;
}
function nameOfB(catalog, opt) {
  return opt.name ?? nameOf(catalog, opt.movement);
}
function blockBLines(catalog, opt) {
  const name = nameOfB(catalog, opt);
  const lines = [`Building \u2014 ${name} tempo ${opt.tempo ?? ""}`.trim()];
  for (const st of opt.steps) lines.push(stepLine(name, st, opt.tempo));
  return lines;
}
function finisherLines(catalog, opt) {
  const lines = [`Finisher \u2014 ${opt.rounds} rounds, rythme continu :`];
  for (const m of opt.movements) {
    const name = m.name ?? nameOf(catalog, m.id);
    lines.push(m.unit === "s" ? `${m.qty} s ${name}` : m.unit === "m" ? `${m.qty} m ${name}` : `${m.qty} ${name}`);
  }
  return lines;
}
function blocCRepsRx(wod) {
  const b = wod.blocks[0];
  const budgetS = wod.budget_min * 60;
  const ref = referenceCategory(wod);
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
          mult = Math.ceil(budgetS / roundSeconds(b, ref));
          break;
        case "ladder": {
          if (!b.ladder) break;
          const { step } = ladderProgress(b, ref, budgetS);
          const start = b.ladder?.start ?? gm.qty;
          const inc = b.ladder?.step ?? gm.qty;
          const n = inc > 0 ? Math.max(1, Math.floor((step - start) / inc) + 1) : 1;
          mult = n * (start + (n - 1) * inc / 2) / Math.max(1, gm.qty);
          break;
        }
        case "death_by": {
          const n = deathByMinute(b, ref, wod.budget_min);
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
function hybridJumpReps(sessions) {
  let n = 0;
  for (const s of sessions) {
    if (!s.bloc_c) continue;
    const reps = blocCRepsRx(s.bloc_c);
    for (const id of HYBRID_JUMP_IDS) n += reps[id] ?? 0;
  }
  return n;
}
var CAL_TO_M = 10;
function blocCRunMeters(catalog, wod) {
  const reps = blocCRepsRx(wod);
  let total2 = 0;
  for (const gm of wod.blocks[0].movements) {
    const m = movementById(catalog, gm.id);
    if (!m || m.modality !== "M") continue;
    const qty = reps[gm.id] ?? 0;
    if (gm.unit === "cal") total2 += qty * CAL_TO_M;
    else if (gm.unit === "m") total2 += qty;
  }
  return total2;
}
function itemsOf(opt) {
  return [...opt.station?.items ?? [], ...opt.race?.stations ?? [], ...opt.compromised?.stations ?? []];
}
function blockARunMeters(catalog, opt) {
  const ofItem = (it, times) => {
    const m = movementById(catalog, it.id);
    if (!m || m.modality !== "M") return 0;
    return (it.unit === "cal" ? it.qty * CAL_TO_M : it.unit === "m" ? it.qty : 0) * times;
  };
  if (opt.station) {
    const { rounds, items } = opt.station;
    return items.reduce((n, it) => n + ofItem(it, Math.ceil(rounds / items.length)), 0);
  }
  if (opt.race) {
    const { rounds, run_m, stations } = opt.race;
    const stationsM = Array.from({ length: rounds }, (_, i) => ofItem(stations[i % stations.length], 1)).reduce((a, b) => a + b, 0);
    return rounds * run_m + stationsM;
  }
  if (opt.compromised) {
    const { rounds, stations } = opt.compromised;
    const stationsM = Array.from({ length: rounds }, (_, i) => ofItem(stations[i % stations.length], 1)).reduce((a, b) => a + b, 0);
    return totalRunOf(opt) + stationsM;
  }
  return 0;
}
function runVariantMeters(opt, iso_week) {
  if (!opt.run) return 0;
  return opt.run.variants[iso_week % opt.run.variants.length].meters;
}
function hybridRunMeters(sessions) {
  return sessions.reduce((n, s) => n + (s.run_meters ?? 0), 0);
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
var trackOf = (sk) => sk.track ?? "functional";
function skeletonForDay(bank, day, track, iso_week) {
  const sameDay = bank.session_skeletons.filter((s) => s.day === day && trackOf(s) === track);
  const special = sameDay.find((s) => s.weeks_modulo && iso_week % s.weeks_modulo.modulo === s.weeks_modulo.equals);
  const sk = special ?? sameDay.find((s) => !s.weeks_modulo);
  if (!sk) throw new InvalidSessionParams("no_skeleton", `Aucun squelette de s\xE9ance ${track} pour le jour ${day}`);
  return sk;
}
function loadOf(catalog, id, band) {
  if (!band) return null;
  const m = movementById(catalog, id);
  if (!m?.loads) return null;
  const men = loadsFor(m, "men", band);
  const women = loadsFor(m, "women", band);
  if (!men?.length || !women?.length) return null;
  return { men: men[0], women: women[0], unit: m.load_unit ?? "kg" };
}
function loadPair(catalog, it) {
  const own = loadOf(catalog, it.id, it.band);
  const extra = it.load_from ? loadOf(catalog, it.load_from, it.band) : null;
  const parts = [];
  if (own && own.unit === "cm") parts.push(`(box ${own.men}/${own.women} cm)`);
  else if (own) parts.push(`@ ${own.men}/${own.women} ${own.unit}`);
  if (extra) parts.push(`@ ${extra.men}/${extra.women} ${extra.unit}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}
function stationLine(catalog, it) {
  const name = it.name ?? nameOf(catalog, it.id);
  const qty = it.unit === "reps" ? `${it.qty}` : `${it.qty} ${it.unit}`;
  return `${qty} ${name}${loadPair(catalog, it)}`;
}
function proLine(catalog, items) {
  const parts = [];
  for (const it of items) {
    if (!it.band) continue;
    const m = movementById(catalog, it.id);
    if (!m?.loads) continue;
    if ((m.load_unit ?? "kg") === "cm") continue;
    const men = loadsFor(m, "men_pro", it.band);
    const women = loadsFor(m, "women_pro", it.band);
    if (!men?.length || !women?.length) continue;
    parts.push(`${it.name ?? nameOf(catalog, it.id)} ${men[0]}/${women[0]} ${m.load_unit ?? "kg"}`);
  }
  return parts.length ? `Women Pro / Men Pro : ${parts.join(" \xB7 ")}` : null;
}
function drawRace(opt, rng) {
  const shuffle = (xs) => {
    const pool = [...xs];
    const out = [];
    while (pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    return out;
  };
  if (opt.compromised) {
    const c = opt.compromised;
    const runs = Array.from({ length: c.rounds }, () => rng.int(c.run_m_min / 100, c.run_m_max / 100) * 100);
    let total2 = runs.reduce((a, b) => a + b, 0);
    while (total2 < HYBRID_FRIDAY_RUN_M) {
      const i = runs.indexOf(Math.min(...runs));
      if (runs[i] >= c.run_m_max) break;
      runs[i] += 100;
      total2 += 100;
    }
    return { ...opt, compromised: { ...c, stations: shuffle(c.stations), runs } };
  }
  const race = opt.race;
  if (!race || race.ordered) return opt;
  const rounds = rng.int(race.rounds_min ?? race.rounds, race.rounds_max ?? race.rounds);
  return { ...opt, race: { ...race, rounds, stations: shuffle(race.stations) } };
}
function runOfRound(opt, i) {
  const c = opt.compromised;
  if (!c) return 0;
  return c.runs?.[i] ?? Math.round((c.run_m_min + c.run_m_max) / 200) * 100;
}
function totalRunOf(opt) {
  const c = opt.compromised;
  if (!c) return 0;
  return Array.from({ length: c.rounds }, (_, i) => runOfRound(opt, i)).reduce((a, b) => a + b, 0);
}
function hybridALines(catalog, opt, iso_week) {
  const lines = [];
  if (opt.kind === "station" && opt.station) {
    const { every_s, rounds, items } = opt.station;
    lines.push(items.length > 1 ? `Every ${fmtEvery(every_s)} \xD7 ${rounds}, en rotation :` : `Every ${fmtEvery(every_s)} \xD7 ${rounds} :`);
    for (const [i, it] of items.entries()) {
      const tag = items.length === 2 ? `${i === 0 ? "Impair" : "Pair"} \xB7 ` : items.length > 2 ? `Poste ${i + 1} \xB7 ` : "";
      lines.push(`${tag}${stationLine(catalog, it)}`);
    }
    const pro = proLine(catalog, items);
    if (pro) lines.push(pro);
    if (items.some((it) => it.band === "heavy")) {
      lines.push("Seule charge lourde de la semaine. Pouss\xE9e continue, jamais en saccades.");
    }
  } else if (opt.kind === "run" && opt.run) {
    const v = opt.run.variants[iso_week % opt.run.variants.length];
    lines.push(`Intervalles course \u2014 ${v.label}, repos ${fmtRest2(v.rest_s)}`);
    lines.push(`Allure cible : ${v.target}. L'\xE9cart entre le premier et le dernier intervalle reste sous 5 s.`);
    lines.push(`Autres variantes du cycle : ${opt.run.variants.filter((x) => x !== v).map((x) => x.label).join(" \xB7 ")}`);
  } else if (opt.kind === "compromised" && opt.compromised) {
    const { rounds, work_s, run_m_min, run_m_max, stations, target } = opt.compromised;
    lines.push(`${rounds} rounds :`);
    for (let i = 0; i < rounds; i++) {
      const st = stations[i % stations.length];
      const run = runOfRound(opt, i);
      lines.push(`${i + 1}. ${work_s} s de station \u2014 ${stationLine(catalog, st)}`);
      lines.push(`   puis ${run} m Run \xE0 allure cible (${target})`);
    }
    const used = Array.from({ length: rounds }, (_, i) => stations[i % stations.length]);
    const pro = proLine(catalog, used);
    if (pro) lines.push(pro);
    lines.push(`Total de course : ${totalRunOf(opt)} m. Tenir l'allure avec les jambes charg\xE9es, ne pas sprinter la station.`);
  } else if (opt.kind === "race" && opt.race) {
    const { rounds, run_m, stations, score } = opt.race;
    lines.push(`Encha\xEEnement chronom\xE9tr\xE9 \u2014 ${rounds} tours, dans l'ordre :`);
    for (let i = 0; i < rounds; i++) {
      const st = stations[i % stations.length];
      lines.push(`${i + 1}. ${run_m} m Run puis ${stationLine(catalog, st)}`);
    }
    const pro = proLine(catalog, Array.from({ length: rounds }, (_, i) => stations[i % stations.length]));
    if (pro) lines.push(pro);
    lines.push(`Score : ${score}. Note le temps de chaque segment.`);
  }
  return lines;
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
  const track = params.track ?? "functional";
  const sk = skeletonForDay(bank, params.day, track, params.iso_week);
  const rng = new RNG(seed);
  const weeks = params.iso_week % 2 === 0 ? "even" : "odd";
  const relax = /* @__PURE__ */ new Set();
  let optA = null;
  if (sk.block_a) {
    const eligible = sk.block_a.filter((o) => !o.weeks || o.weeks === weeks);
    optA = withSkillProgression(rng.pick(eligible.length ? eligible : sk.block_a));
    optA = drawRace(optA, rng);
  }
  const optW = sk.block_work?.length ? drawRace(rng.pick(sk.block_work), rng) : null;
  const cool = sk.cooldown?.length ? rng.pick(sk.cooldown) : null;
  const movA = optA ? movementById(catalog, optA.movement) : void 0;
  const heavy = optA && (optA.kind === "weightlifting" || optA.kind === "strength") ? heavyPatternOf(movA) : null;
  const { c: recentC, finishers: journalFinishers } = splitSignatures(params.recent_signatures ?? []);
  let optB = null;
  if (sk.block_b) {
    const aIds = new Set([optA?.movement, ...optA?.complex ?? []].filter((x) => !!x));
    const sameAsA = (id) => aIds.has(id) || aIds.has(id.replace(/^strict_/, ""));
    const base = sk.block_b.filter((o) => !sameAsA(o.movement) && (!heavy || o.pattern !== heavy));
    const weekB = new Set(params.week_b_movements ?? []);
    const fresh = base.filter((o) => !weekB.has(o.movement));
    if (fresh.length) optB = rng.pick(fresh);
    else if (base.length) {
      optB = rng.pick(base);
      relax.add("b_repeat_week");
    } else {
      optB = null;
      relax.add("b_none");
    }
  }
  let optF = null;
  if (sk.finisher) {
    const used = /* @__PURE__ */ new Set([...journalFinishers, ...params.recent_finishers ?? []]);
    const fresh = sk.finisher.filter((o) => !used.has(o.id));
    if (fresh.length) optF = rng.pick(fresh);
    else {
      optF = rng.pick(sk.finisher);
      relax.add("finisher_repeat");
    }
  }
  const cFilter = sk.block_c;
  const fixed = sk.warmup.minutes + (optA?.minutes ?? 0) + (optW?.minutes ?? 0) + (cool?.minutes ?? 0);
  const lo = sk.budget_min * (1 - SESSION_TOLERANCE);
  const hi = sk.budget_min * (1 + SESSION_TOLERANCE);
  const combos = [];
  for (const c of cFilter ? cFilter.durations : [0]) for (const b of [true, false]) for (const f of [true, false]) {
    if (b && !optB) continue;
    if (f && !optF) continue;
    combos.push({ c, b, f });
  }
  const totalOf = (x) => {
    const blocks2 = (cFilter ? 1 : 0) + (optA ? 1 : 0) + (optW ? 1 : 0) + (cool ? 1 : 0) + (x.b ? 1 : 0) + (x.f ? 1 : 0);
    return fixed + x.c + (x.b ? optB.minutes : 0) + (x.f ? optF.minutes : 0) + TRANSITION_MIN * blocks2;
  };
  const fitting = combos.filter((x) => totalOf(x) >= lo && totalOf(x) <= hi);
  const pool = fitting.length ? fitting : combos.sort((a, b) => Math.abs(totalOf(a) - sk.budget_min) - Math.abs(totalOf(b) - sk.budget_min)).slice(0, 1);
  if (!fitting.length) relax.add("session_budget");
  const rank = (x) => (x.b ? 2 : 0) + (x.f ? 1 : 0);
  const bestRank = Math.max(...pool.map(rank));
  let choice = rng.pick(pool.filter((x) => rank(x) === bestRank));
  const patternNot = cFilter ? [
    ...cFilter.pattern_not === "heavy_pattern" ? heavy ? [heavy] : [] : cFilter.pattern_not,
    ...params.pattern_not ?? []
  ] : [];
  const intention = cFilter ? rng.pick(cFilter.intentions) : "mixed";
  const format = cFilter?.formats ? rng.pick(cFilter.formats) : void 0;
  const cSeed = seed + 104729 * params.day >>> 0;
  const aIdsHybrid = track === "hybrid" && optA ? [...optA.station?.items ?? [], ...optA.race?.stations ?? []].map((it) => it.id) : [];
  const exclude = [
    ...cFilter?.exclude ?? [],
    ...params.exclude ?? [],
    ...track === "hybrid" ? [...HYBRID_FORBIDDEN_IDS, ...aIdsHybrid] : []
  ];
  const neighbours = [params.previous_c_skeleton, params.next_c_skeleton].filter((s) => !!s);
  const cDiscipline = track === "hybrid" ? "hybrid" : "functional";
  const outside = cFilter?.skeletons ? bank.skeletons.filter((s) => s.discipline === cDiscipline && !cFilter.skeletons.includes(s.id)).map((s) => s.id) : [];
  const notList = [.../* @__PURE__ */ new Set([...neighbours, ...outside])];
  const skeletonNot = notList.length ? notList : void 0;
  const attempts = [
    { tag: null, c: choice.c, intention, format, patternNot }
  ];
  attempts.push({ tag: "c_fallback:reseed", c: choice.c, intention, format, patternNot });
  if (format) attempts.push({ tag: "c_fallback:format", c: choice.c, intention, format: void 0, patternNot });
  for (const c of cFilter?.durations ?? []) if (c !== choice.c) attempts.push({ tag: "c_fallback:duration", c, intention, format, patternNot });
  if (format) {
    for (const c of cFilter?.durations ?? []) if (c !== choice.c) attempts.push({ tag: "c_fallback:duration", c, intention, format: void 0, patternNot });
  }
  for (const i of cFilter?.intentions ?? []) if (i !== intention) attempts.push({ tag: "c_fallback:intention", c: choice.c, intention: i, format: void 0, patternNot });
  if (patternNot.length) attempts.push({ tag: "c_fallback:pattern", c: choice.c, intention, format: void 0, patternNot: [] });
  for (const i of cFilter?.intentions ?? []) {
    attempts.push({ tag: "c_fallback:signature", c: choice.c, intention: i, format: void 0, patternNot: [], noRecent: true });
  }
  let blocC = null;
  let lastErr = null;
  let fallbackC = null;
  for (const [idx, a] of cFilter ? attempts.entries() : []) {
    try {
      const candidate = generateBlocC({
        entry: "express",
        discipline: cDiscipline,
        budget_min: a.c,
        intention: a.intention,
        format: a.format,
        exclude,
        recent_signatures: a.noRecent ? [] : recentC,
        pattern_not: a.patternNot.length ? a.patternNot : void 0,
        skeleton_not: skeletonNot,
        round_qty: true
      }, catalog, bank, idx === 0 ? cSeed : hashSeed(cSeed, a.tag ?? "", idx));
      if (sk.max_rpe !== void 0 && candidate.stimulus.rpe > sk.max_rpe) {
        fallbackC = fallbackC ?? { wod: candidate, tag: a.tag, c: a.c };
        continue;
      }
      blocC = candidate;
      if (a.tag) relax.add(a.tag);
      if (a.c !== choice.c) choice = { ...choice, c: a.c };
      break;
    } catch (e) {
      if (!(e instanceof NoValidWod)) throw e;
      lastErr = e;
    }
  }
  if (cFilter && !blocC && fallbackC) {
    blocC = fallbackC.wod;
    if (fallbackC.tag) relax.add(fallbackC.tag);
    if (fallbackC.c !== choice.c) choice = { ...choice, c: fallbackC.c };
    relax.add("rpe_over_cap");
  }
  if (cFilter && !blocC) throw lastErr;
  if (blocC) for (const r of blocC.generator.relaxations) relax.add(`c:${r}`);
  const blocks = [];
  const gym = {};
  const warm = [...sk.warmup.lines, ""];
  let sort = 0;
  if (optA) {
    const isHybridA = optA.kind === "station" || optA.kind === "run" || optA.kind === "race";
    const lines = isHybridA ? hybridALines(catalog, optA, params.iso_week) : blockALines(catalog, optA, weeks);
    const aReps = {};
    if (optA.skill) aReps[optA.movement] = optA.skill.reps * optA.skill.rounds;
    addReps(gym, gymReps(catalog, aReps));
    const KIND_LABEL = {
      weightlifting: "Halt\xE9ro",
      strength: "Force",
      skill: "Skill",
      station: "Force sur station",
      run: "Course",
      race: "Simulation",
      compromised: "Course compromise"
    };
    const title = optA.kind === "race" ? sk.label : `${KIND_LABEL[optA.kind]} \xB7 ${nameOf(catalog, optA.movement)}`;
    const a = editor(
      title,
      [...warm, ...lines].join("\n"),
      optA.kind === "skill" || isHybridA ? "custom" : "strength",
      optA.timed ? "wod" : optA.kind === "skill" ? "skill" : "strength",
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
      optA.kind === "weightlifting" ? "Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre." : optA.timed ? "S\xE9ance chronom\xE9tr\xE9e de bout en bout : compare avec ta derni\xE8re simulation." : null
    );
    if (optA.timed) a.leaderboard_enabled = true;
    blocks.push(a);
  }
  if (choice.b && optB) {
    const bReps = {};
    for (const st of optB.steps) bReps[optB.movement] = (bReps[optB.movement] ?? 0) + st.sets * st.reps;
    addReps(gym, gymReps(catalog, bReps));
    blocks.push(editor(
      `Building \xB7 ${nameOfB(catalog, optB)}`,
      blockBLines(catalog, optB).join("\n"),
      "strength",
      "building",
      sort++,
      optB.minutes,
      structured("building", optB.id, { movement: optB.movement, steps: optB.steps, gym_reps_rx: gymReps(catalog, bReps) }),
      null
    ));
  }
  if (optW) {
    const wLines = hybridALines(catalog, optW, params.iso_week);
    const w = editor(
      optW.kind === "race" ? sk.label : `${sk.label} \xB7 ${nameOf(catalog, optW.movement)}`,
      [...optA ? [] : warm, ...wLines].join(NL),
      "custom",
      "wod",
      sort++,
      optW.minutes + (optA ? 0 : sk.warmup.minutes),
      structured(optW.kind, optW.id, { movement: optW.movement, gym_reps_rx: {} }),
      optW.timed ? "S\xE9ance chronom\xE9tr\xE9e de bout en bout : compare avec ta derni\xE8re simulation." : null
    );
    w.leaderboard_enabled = true;
    blocks.push(w);
  }
  if (blocC) {
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
  }
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
  if (cool) {
    blocks.push(editor(
      "Retour au calme",
      cool.lines.join(NL),
      "custom",
      "cooldown",
      sort++,
      cool.minutes,
      structured("cooldown", `cooldown_${cool.minutes}`, {}),
      null
    ));
  }
  const rpe = Math.max(optA?.rpe ?? 0, optW?.rpe ?? 0, blocC?.stimulus.rpe ?? 0);
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
    // Sans bloc C (séance chronométrée), la signature vient du squelette et de son bloc A :
    // l'anti-répétition sur 4 semaines reste calculable.
    signature: blocC ? blocC.signature : `session|${sk.id}|${optA?.id ?? "-"}|${optA?.race ? `${optA.race.rounds}x${optA.race.run_m}:${optA.race.stations.map((x) => x.id).join(",")}` : "-"}`,
    block_b_movement: choice.b && optB ? optB.movement : null,
    finisher_id: choice.f && optF ? optF.id : null,
    rpe,
    movements_by_role: {
      a: optA ? itemsOf(optA).map((it) => it.id) : [],
      work: [
        ...optW ? itemsOf(optW).map((it) => it.id) : [],
        ...blocC ? blocC.blocks[0].movements.map((m) => m.id) : []
      ]
    },
    run_meters: (optA ? blockARunMeters(catalog, optA) + runVariantMeters(optA, params.iso_week) : 0) + (optW ? blockARunMeters(catalog, optW) : 0) + (blocC ? blocCRunMeters(catalog, blocC) : 0)
  };
}
function generateWeek(params, catalog, bank, seed) {
  const relax = /* @__PURE__ */ new Set();
  const track = params.track ?? "functional";
  const recent = [...params.recent_signatures ?? []];
  const sessions = [];
  const functionalOnly = (ids) => ids.filter((id) => movementById(catalog, id)?.modality !== "M");
  const writtenOf = (d) => {
    const sk = bank.session_skeletons.find((x) => x.day === d && trackOf(x) === track && (x.weeks_modulo ? params.iso_week % x.weeks_modulo.modulo === x.weeks_modulo.equals : true));
    if (!sk) return [];
    return functionalOnly([...sk.block_a ?? [], ...sk.block_work ?? []].flatMap((o) => itemsOf(o).map((it) => it.id)));
  };
  const alreadyUsed = (day) => {
    if (track !== "hybrid") return [];
    const days = /* @__PURE__ */ new Map();
    const neighbour = /* @__PURE__ */ new Set();
    const note = (d, ids) => {
      for (const id of ids) days.set(id, (days.get(id) ?? /* @__PURE__ */ new Set()).add(d));
      if (Math.abs(d - day) === 1) for (const id of ids) neighbour.add(id);
    };
    for (const d of [day - 1, day + 1]) if (d >= 1 && d <= 6) note(d, writtenOf(d));
    for (const s of sessions) {
      if (s.day === day) continue;
      const roles = s.movements_by_role ?? { a: [], work: [] };
      note(s.day, functionalOnly([...roles.a, ...roles.work]));
    }
    const out = new Set(neighbour);
    for (const [id, ds] of days) if (ds.size >= 2) out.add(id);
    return [...out];
  };
  const once = (day, salt, patternNot, extraExclude = [], unique = true) => generateSession({
    track,
    day,
    iso_year: params.iso_year,
    iso_week: params.iso_week,
    recent_signatures: [...recent, ...sessions.filter((s) => s.day !== day).map((s) => s.signature)],
    week_b_movements: sessions.filter((s) => s.day !== day).flatMap((s) => s.block_b_movement ? [s.block_b_movement] : []),
    recent_finishers: sessions.filter((s) => s.day !== day).flatMap((s) => s.finisher_id ? [s.finisher_id] : []),
    previous_c_skeleton: sessions.find((s) => s.day === day - 1)?.bloc_c?.generator.skeleton_id ?? null,
    next_c_skeleton: sessions.find((s) => s.day === day + 1)?.bloc_c?.generator.skeleton_id ?? null,
    pattern_not: patternNot,
    exclude: [...params.exclude ?? [], ...unique ? alreadyUsed(day) : [], ...extraExclude]
  }, catalog, bank, seed + day * 7919 + salt * 104729 >>> 0);
  const onceRelaxed = (day, salt, patternNot, extraExclude = []) => {
    try {
      return once(day, salt, patternNot, extraExclude);
    } catch (e) {
      if (!(e instanceof NoValidWod)) throw e;
      relax.add(`movement_repeat_week:${day}`);
      return once(day, salt, patternNot, extraExclude, false);
    }
  };
  const repeatsB = (s) => s.generator.relaxations.includes("b_repeat_week");
  const gen = (day, patternNot) => onceRelaxed(day, 0, patternNot);
  for (const day of [1, 2, 3, 4, 5, 6]) {
    sessions.push(gen(day));
    if (!repeatsB(sessions[sessions.length - 1])) continue;
    const saved = [...sessions];
    let solved = false;
    for (let back = 1; back < day && !solved; back++) {
      for (let salt = 1; salt <= B_RETRY_MAX && !solved; salt++) {
        sessions.splice(day - 1 - back);
        sessions.push(onceRelaxed(day - back, salt));
        for (let d = day - back + 1; d <= day; d++) sessions.push(onceRelaxed(d, 0));
        solved = sessions.slice(day - 1 - back).every((s) => !repeatsB(s));
      }
    }
    if (!solved) sessions.splice(0, sessions.length, ...saved);
  }
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
  if (track === "hybrid") {
    for (let pass = 0; pass < 3 && hybridJumpReps(sessions) > HYBRID_WEEKLY_JUMP_CAP; pass++) {
      const worst = [...sessions].sort((a, b) => hybridJumpReps([b]) - hybridJumpReps([a]))[0];
      if (!worst || hybridJumpReps([worst]) === 0) break;
      const i = sessions.findIndex((s) => s.day === worst.day);
      sessions[i] = onceRelaxed(worst.day, 0, void 0, [...HYBRID_JUMP_IDS]);
      relax.add(`weekly_jump_cap:${worst.day}`);
    }
    if (hybridJumpReps(sessions) > HYBRID_WEEKLY_JUMP_CAP) relax.add("weekly_jump_cap_exceeded");
    const rpeOf = (s) => s.rpe;
    const HARD_RETRY = 8;
    for (let i = 1; i < sessions.length; i++) {
      if (rpeOf(sessions[i]) < HYBRID_HARD_RPE || rpeOf(sessions[i - 1]) < HYBRID_HARD_RPE) continue;
      let best = sessions[i];
      for (let salt = 1; salt <= HARD_RETRY; salt++) {
        const candidate = onceRelaxed(sessions[i].day, salt);
        if (rpeOf(candidate) < rpeOf(best)) best = candidate;
        if (rpeOf(candidate) < HYBRID_HARD_RPE) break;
      }
      sessions[i] = best;
      if (rpeOf(best) >= HYBRID_HARD_RPE) relax.add(`hard_days_in_a_row:${best.day}`);
      else relax.add(`hard_day_softened:${best.day}`);
    }
    const SLED_OK = /* @__PURE__ */ new Set(["sled_push", "sled_pull"]);
    const byMovement = /* @__PURE__ */ new Map();
    for (const s of sessions) {
      const roles = s.movements_by_role ?? { a: [], work: [] };
      for (const id of functionalOnly([...roles.a, ...roles.work])) {
        byMovement.set(id, (byMovement.get(id) ?? /* @__PURE__ */ new Set()).add(s.day));
      }
    }
    for (const [id, ds] of byMovement) {
      const days = [...ds].sort((a, b) => a - b);
      if (days.length < 2) continue;
      const adjacent = days.some((d, i) => i > 0 && d - days[i - 1] === 1);
      if (SLED_OK.has(id) && days.every((d) => d === 5 || d === 6)) continue;
      if (days.length > 2 || adjacent) relax.add(`movement_repeat_week:${id}`);
    }
    if (hybridRunMeters(sessions) < HYBRID_WEEKLY_RUN_M) relax.add("weekly_run_short");
  }
  return {
    track,
    iso_year: params.iso_year,
    iso_week: params.iso_week,
    seed,
    sessions,
    gym_volume,
    relaxations: [...relax].sort(),
    signatures: [...sessions.map((s) => s.signature), ...sessions.flatMap((s) => s.finisher_id ? [finisherSignature(s.finisher_id)] : [])]
  };
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
  const order = [...MUSCU_WEEK_DAYS].sort((a, b) => TARGET_MUSCLES[a.target].length - TARGET_MUSCLES[b.target].length || a.day - b.day);
  for (const d of order) {
    const dayObjective = d.target === "tronc" && objective === "force" ? "hypertrophie" : objective;
    const weekly_room = {};
    for (const [mu, n] of setsByMuscle(days)) weekly_room[mu] = Math.max(0, MUSCU_WEEKLY_CAP_SETS - n);
    const week_seen = days.flatMap((x) => x.wod.blocks[0].exercises.map((e) => ({
      id: e.id,
      group: e.movement_group,
      day: x.day,
      role: e.role
    })));
    const wod = generateMuscu({
      entry: "express",
      target: d.target,
      objective: dayObjective,
      budget_min: d.budget_min,
      equipment,
      level,
      exclude: params.exclude,
      recent_signatures: [...recent, ...days.map((x) => x.wod.signature)],
      box_wod: true,
      weekly_room,
      week_seen,
      week_day: d.day
    }, catalog, bank, seed + d.day * 7919 >>> 0);
    for (const r of wod.generator.relaxations) relax.add(`${d.target}:${r}`);
    days.push({ day: d.day, target: d.target, budget_min: d.budget_min, wod });
  }
  days.sort((a, b) => a.day - b.day);
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
var TRACKS = ["functional", "hybrid", "musculation"];
var TRACK_LABEL = { functional: "Functional", hybrid: "Hybrid", musculation: "Musculation" };
var TRACK_GROUP_NAME = { functional: "Functional", hybrid: "Hybrid", musculation: "Musculation" };
var TRACK_SEED_KEY = { functional: "crossfit", hybrid: "hybrid", musculation: "musculation" };
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
var DEFAULT_REVEAL = { mode: "weekly", dow: 0, time: `${REVEAL_HOUR_PARIS}:00` };
function revealFromRow(mode, dow, time) {
  const d = typeof dow === "number" ? dow : Number(dow);
  return {
    mode: mode === "daily" ? "daily" : "weekly",
    dow: Number.isInteger(d) && d >= 0 && d <= 6 ? d : DEFAULT_REVEAL.dow,
    time: typeof time === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(time) ? time : DEFAULT_REVEAL.time
  };
}
function parisInstant(ymd, time) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = time.split(":").map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  const offset = parisOffsetMinutes(new Date(midnightUtc + 12 * 36e5));
  return new Date(midnightUtc + ((hh * 60 + mm) * 60 + ss) * 1e3 - offset * 6e4).toISOString();
}
function weeklyRevealDate(iso_year, iso_week, dow) {
  const monday = isoWeekMonday(iso_year, iso_week);
  const daysBefore = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  return new Date(monday.getTime() - daysBefore * 864e5).toISOString().slice(0, 10);
}
function revealAt(iso_year, iso_week, reveal = DEFAULT_REVEAL) {
  return parisInstant(weeklyRevealDate(iso_year, iso_week, reveal.dow), reveal.time);
}
function publishAtFor(scheduled_date, iso_year, iso_week, reveal = DEFAULT_REVEAL) {
  return reveal.mode === "daily" ? parisInstant(scheduled_date, reveal.time) : revealAt(iso_year, iso_week, reveal);
}
function weekSeed(box_id, track, iso_year, iso_week, regen_counter) {
  return hashSeed(box_id, TRACK_SEED_KEY[track], iso_year, iso_week, regen_counter);
}
function functionalWeekRows(week, ctx) {
  const dates = weekDates(ctx.iso_year, ctx.iso_week);
  const publishAt = (date) => publishAtFor(date, ctx.iso_year, ctx.iso_week, ctx.reveal);
  const rows2 = [];
  for (const s of week.sessions) {
    for (const b of s.blocks) {
      rows2.push({
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
        publish_at: publishAt(dates[s.day - 1]),
        audience: "all",
        sort_order: b.sort_order,
        wod_json: b.wod_json,
        source: "auto",
        auto_run_id: ctx.run_id,
        track: week.track
      });
    }
  }
  return rows2;
}
function muscuWeekRows(week, ctx) {
  const dates = weekDates(ctx.iso_year, ctx.iso_week);
  const publishAt = (date) => publishAtFor(date, ctx.iso_year, ctx.iso_week, ctx.reveal);
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
    publish_at: publishAt(dates[d.day - 1]),
    audience: "all",
    sort_order: 0,
    wod_json: d.wod,
    source: "auto",
    auto_run_id: ctx.run_id,
    track: "musculation"
  }));
}
async function runWeekGeneration(db, catalog, bank, opts) {
  const target = opts.target ?? nextIsoWeek(opts.now);
  const boxes = (await db.listEnabledBoxes()).filter((b) => !opts.only_box_id || b.id === opts.only_box_id);
  const out = [];
  for (const box of boxes) {
    const tracks = opts.tracks ? box.tracks.filter((t) => opts.tracks.includes(t)) : box.tracks;
    for (const track of tracks) {
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
        const ctx = {
          box_id: box.id,
          created_by: box.owner_id,
          run_id: run.id,
          iso_year: target.iso_year,
          iso_week: target.iso_week,
          reveal: box.reveal
        };
        let rows2;
        let signatures;
        let relaxations;
        if (track === "functional" || track === "hybrid") {
          const week = generateWeek({
            iso_year: target.iso_year,
            iso_week: target.iso_week,
            recent_signatures: recent,
            track
          }, catalog, bank, seed);
          rows2 = functionalWeekRows(week, ctx);
          signatures = week.signatures;
          relaxations = [...week.relaxations, ...week.sessions.flatMap((s) => s.generator.relaxations.map((r) => `${DAY_LABEL[s.day]}:${r}`))];
        } else {
          const week = generateMuscuWeek({ iso_year: target.iso_year, iso_week: target.iso_week, recent_signatures: recent }, catalog, bank, seed);
          rows2 = muscuWeekRows(week, ctx);
          signatures = week.days.map((d) => d.wod.signature);
          relaxations = week.relaxations;
        }
        const previous = existing ? await db.listAutoRows(existing.id) : [];
        const keptDates = new Set(previous.filter((r) => r.edited_at || r.scored).map((r) => r.scheduled_date));
        const toDelete = previous.filter((r) => !keptDates.has(r.scheduled_date)).map((r) => r.id);
        if (toDelete.length) await db.deleteRows(toDelete);
        const keptIds = previous.filter((r) => keptDates.has(r.scheduled_date)).map((r) => r.id);
        const inserts = rows2.filter((r) => !keptDates.has(r.scheduled_date));
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

// packages/wod-engine/src/bank/feasibility.ts
var FEASIBILITY = [
  { id: "couplet_for_time_21_15_9", discipline: "functional", format: "for_time", intention: "mixed", feasible: true },
  { id: "couplet_for_time_21_15_9", discipline: "functional", format: "for_time", intention: "gym", feasible: true },
  { id: "couplet_for_time_21_15_9", discipline: "functional", format: "for_time", intention: "force", feasible: true },
  { id: "triplet_for_time_classics", discipline: "functional", format: "for_time", intention: "mixed", feasible: true },
  { id: "triplet_for_time_classics", discipline: "functional", format: "for_time", intention: "gym", feasible: true },
  { id: "triplet_for_time_classics", discipline: "functional", format: "for_time", intention: "force", feasible: true },
  { id: "couplet_amrap_short", discipline: "functional", format: "amrap", intention: "mixed", feasible: true },
  { id: "couplet_amrap_short", discipline: "functional", format: "amrap", intention: "cardio", feasible: true },
  { id: "couplet_amrap_short", discipline: "functional", format: "amrap", intention: "gym", feasible: true },
  { id: "triplet_amrap_mid", discipline: "functional", format: "amrap", intention: "mixed", feasible: true },
  { id: "triplet_amrap_mid", discipline: "functional", format: "amrap", intention: "cardio", feasible: true },
  { id: "triplet_amrap_mid", discipline: "functional", format: "amrap", intention: "gym", feasible: true },
  { id: "triplet_rounds_for_time", discipline: "functional", format: "rounds_for_time", intention: "mixed", feasible: true },
  { id: "triplet_rounds_for_time", discipline: "functional", format: "rounds_for_time", intention: "force", feasible: true },
  { id: "chipper_descending", discipline: "functional", format: "chipper", intention: "mixed", feasible: true },
  { id: "chipper_descending", discipline: "functional", format: "chipper", intention: "cardio", feasible: true },
  { id: "chipper_stations_erg", discipline: "functional", format: "chipper", intention: "mixed", feasible: true },
  { id: "chipper_stations_erg", discipline: "functional", format: "chipper", intention: "cardio", feasible: true },
  { id: "emom_alternating", discipline: "functional", format: "emom", intention: "mixed", feasible: true },
  { id: "emom_alternating", discipline: "functional", format: "emom", intention: "gym", feasible: true },
  { id: "emom_alternating", discipline: "functional", format: "emom", intention: "force", feasible: true },
  { id: "interval_work_rest", discipline: "functional", format: "interval", intention: "mixed", feasible: true },
  { id: "interval_work_rest", discipline: "functional", format: "interval", intention: "cardio", feasible: true },
  { id: "interval_work_rest", discipline: "functional", format: "interval", intention: "force", feasible: true },
  { id: "ladder_ascending", discipline: "functional", format: "ladder", intention: "mixed", feasible: true },
  { id: "ladder_ascending", discipline: "functional", format: "ladder", intention: "gym", feasible: true },
  { id: "ladder_finite", discipline: "functional", format: "ladder", intention: "mixed", feasible: true },
  { id: "ladder_finite", discipline: "functional", format: "ladder", intention: "gym", feasible: true },
  { id: "death_by", discipline: "functional", format: "death_by", intention: "mixed", feasible: true },
  { id: "death_by", discipline: "functional", format: "death_by", intention: "force", feasible: true },
  { id: "tabata_pair", discipline: "functional", format: "tabata", intention: "cardio", feasible: true },
  { id: "tabata_pair", discipline: "functional", format: "tabata", intention: "gym", feasible: true },
  { id: "heavy_couplet", discipline: "functional", format: "rounds_for_time", intention: "force", feasible: true },
  { id: "engine_long_amrap", discipline: "functional", format: "amrap", intention: "cardio", feasible: true },
  { id: "gym_density", discipline: "functional", format: "emom", intention: "gym", feasible: true },
  { id: "stations_rotation", discipline: "functional", format: "stations", intention: "mixed", feasible: true },
  { id: "stations_rotation", discipline: "functional", format: "stations", intention: "cardio", feasible: true },
  { id: "run_into_station", discipline: "hybrid", format: "rounds_for_time", intention: "interval", feasible: true },
  { id: "run_into_station", discipline: "hybrid", format: "rounds_for_time", intention: "engine", feasible: true },
  { id: "run_into_station", discipline: "hybrid", format: "rounds_for_time", intention: "run", feasible: true },
  { id: "stations_interval", discipline: "hybrid", format: "stations", intention: "interval", feasible: true },
  { id: "amrap_distances", discipline: "hybrid", format: "amrap", intention: "interval", feasible: true },
  { id: "amrap_distances", discipline: "hybrid", format: "amrap", intention: "engine", feasible: true },
  { id: "erg_pyramid", discipline: "hybrid", format: "for_time", intention: "engine", feasible: true },
  { id: "erg_pyramid", discipline: "hybrid", format: "for_time", intention: "aerobic", feasible: true },
  { id: "sled_repeats", discipline: "hybrid", format: "interval", intention: "force", feasible: true },
  { id: "sled_repeats", discipline: "hybrid", format: "interval", intention: "interval", feasible: true },
  { id: "compromised_run", discipline: "hybrid", format: "rounds_for_time", intention: "interval", feasible: true },
  { id: "compromised_run", discipline: "hybrid", format: "rounds_for_time", intention: "run", feasible: true },
  { id: "half_sim", discipline: "hybrid", format: "rounds_for_time", intention: "interval", feasible: true },
  { id: "engine_continuous", discipline: "hybrid", format: "continuous", intention: "aerobic", feasible: true },
  { id: "core_carry_finisher", discipline: "hybrid", format: "rounds_for_time", intention: "core", feasible: true },
  { id: "run_intervals", discipline: "hybrid", format: "interval", intention: "run", feasible: true },
  { id: "run_intervals", discipline: "hybrid", format: "interval", intention: "engine", feasible: true },
  { id: "engine_negative_split", discipline: "hybrid", format: "continuous", intention: "aerobic", feasible: true }
];

// packages/wod-engine/src/feasibility.ts
var FORMAT_CHOICE_COVERS = {
  amrap: ["amrap"],
  for_time: ["for_time", "rounds_for_time", "ladder"],
  emom: ["emom", "death_by"],
  chipper: ["chipper"],
  stations: ["stations", "continuous"],
  interval: ["interval", "tabata"]
};
var CHOICES = Object.keys(FORMAT_CHOICE_COVERS);
function rows(discipline) {
  return FEASIBILITY.filter((r) => r.discipline === discipline && r.feasible);
}
function formatsOfferedFor(discipline) {
  const served = new Set(rows(discipline).map((r) => r.format));
  return ["surprise", ...CHOICES.filter((c) => FORMAT_CHOICE_COVERS[c].some((f) => served.has(f)))];
}
function feasibleFormats(discipline, intention) {
  const served = new Set(rows(discipline).filter((r) => r.intention === intention).map((r) => r.format));
  const out = new Set(CHOICES.filter((c) => FORMAT_CHOICE_COVERS[c].some((f) => served.has(f))));
  if (served.size) out.add("surprise");
  return out;
}
function combinationFeasible(discipline, intention, format) {
  return feasibleFormats(discipline, intention).has(format);
}
export {
  AFTER_CLASS_DURATIONS,
  BAND_CADENCE_FACTOR,
  BANK_V1,
  BANK_VERSION,
  BEGINNER_LONG_BUDGET_MIN,
  BEGINNER_MAX_EXERCISES,
  BEGINNER_MAX_EXERCISES_LONG,
  BODYWEIGHT_MAX_LOADED,
  BODYWEIGHT_PULL_UP_IDS,
  BONUS_EXCLUDED_IDS,
  CAL_TO_M,
  CARDIO_EXCLUDED_IDS,
  CATALOG_SNAPSHOT,
  CATEGORY_LABEL,
  CORE_MAX_OUTSIDE_TRONC,
  DAY_LABEL,
  DEFAULT_REVEAL,
  DEMOTED_PERCENT_MAX,
  DEMOTED_RANGE,
  DURATION_PROBE_SEEDS,
  ENGINE_MIN_SHARE,
  ENGINE_VERSION,
  EQUIPMENT_FALLBACK,
  EQUIPMENT_LABEL,
  FALLBACK_PRIORITY,
  FAMILY_CAP_FACTOR,
  FEASIBILITY,
  FINISHERS,
  FINISHER_SIGNATURE_PREFIX,
  FORMAT_CHOICE_COVERS,
  FUNCTIONAL_CATEGORIES,
  FUNCTIONAL_SKELETONS,
  GYM_RECORD_FRACTION,
  H1_intervals,
  H2_strength_stations,
  H3_run,
  H4_engine,
  H5_compromised,
  H6_simulation,
  H6_simulation_full,
  HEAVY_MAX,
  HEAVY_PERCENT,
  HEAVY_STATION_REPS,
  HIGH_REP_SETS_MAX,
  HIGH_REP_SETS_REPS_MAX,
  HYBRID_CATEGORIES,
  HYBRID_EASY_RPE,
  HYBRID_FORBIDDEN_IDS,
  HYBRID_FRIDAY_RPE,
  HYBRID_FRIDAY_RUN_M,
  HYBRID_HARD_RPE,
  HYBRID_JUMP_IDS,
  HYBRID_SESSION_SKELETONS,
  HYBRID_SKELETONS,
  HYBRID_TUESDAY_RPE,
  HYBRID_WEEKLY_JUMP_CAP,
  HYBRID_WEEKLY_RUN_M,
  InvalidMuscuParams,
  InvalidSessionParams,
  LEVEL_LABEL,
  MAX_ATTEMPTS,
  MAX_EXERCISES,
  MOVEMENT_CAPS,
  MOVEMENT_GROUPS,
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
  NO_SQUAT_TARGETS,
  NoValidWod,
  OBJECTIVE_LABEL,
  PRIORITY_RANKS,
  PROGRAMMING_VERSION,
  RACK_ONLY_IDS,
  REAR_DELT_PUSH_IDS,
  RECENT_WEEKS,
  REST_EXTRA_MAX,
  REVEAL_HOUR_PARIS,
  RNG,
  RUN_MIN_M,
  S1_snatch,
  S2_squat,
  S3_gym,
  S4_cj,
  S5_hinge,
  S6_long,
  SCHEMES,
  SESSION_BANK_VERSION,
  SESSION_ENGINE_VERSION,
  SESSION_SKELETONS,
  SESSION_TOLERANCE,
  SKILL_STEP_S,
  SQUAT_IDS,
  TARGET_LABEL,
  TARGET_MUSCLES,
  TIME_BOUNDED,
  TOLERANCE,
  TRACKS,
  TRACK_GROUP_NAME,
  TRACK_LABEL,
  TRACK_SEED_KEY,
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
  availableDurations,
  availableTargets,
  bankFromRows,
  blocCRepsRx,
  cadenceFor,
  carriesIntention,
  catalogFromRows,
  categoriesFor,
  combinationFeasible,
  deathByMinute,
  engineShare,
  estimateAll,
  estimateBlock,
  estimateDuration,
  exerciseLine,
  feasibleFormats,
  finisherSignature,
  forceBand,
  formatsOfferedFor,
  functionalRef,
  functionalWeekRows,
  generateBlocC,
  generateMuscu,
  generateMuscuWeek,
  generateSession,
  generateWeek,
  genericCapFor,
  hashSeed,
  heavyAllowed,
  hybridJumpReps,
  hybridRunMeters,
  isFunctionalCategory,
  isMuscuSkeletonRow,
  isSessionSkeletonRow,
  isSlowSkill,
  isoWeek,
  isoWeekMonday,
  itemsOf,
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
  parisInstant,
  parisOffsetMinutes,
  percentForReps,
  primaryPattern,
  priorityFor,
  profileCategory,
  publishAtFor,
  rackAllowed,
  render,
  renderMuscu,
  resolveMovement,
  revealAt,
  revealFromRow,
  roundSeconds,
  runWeekGeneration,
  sessionSeconds,
  sessionSkeletonToRow,
  sideLabel,
  signature,
  skeletonToRow,
  splitSignatures,
  stepLine,
  substitutionFor,
  targetAvailable,
  trackOf,
  weekDates,
  weekSeed,
  weeklyGymVolume,
  weeklyRevealDate,
  weightFor,
  withSkillProgression
};
