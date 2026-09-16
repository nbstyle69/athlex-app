// Généré par scripts/import-catalog.cjs depuis catalog/catalogue-v1.csv — ne pas éditer.
import type { Catalog } from '../types';

export const CATALOG_SNAPSHOT: Catalog = {
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
      "notes": "alterné, reps au total",
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
            1000
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
      "notes": "cal ; 1 cal ≈ 18 m ; Hyrox 1000 m race",
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
            2000
          ],
          "emom": [
            300,
            600
          ],
          "interval": [
            500,
            1000
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
      "notes": "cal F ≈ 0.8 × cal H, à gérer dans le rendu",
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
            1000
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
      "notes": "alterné, reps au total",
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
      "notes": "alterné, reps au total",
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
      "notes": "alterné, reps au total",
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
      "notes": "2 KB ou alterné 1 KB",
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
      "notes": "latéral",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Ancien catalogue app — badges / back-office uniquement",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — lesté possible en force",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — lesté possible en force ; sub débutant : lat pulldown ou banded",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — à deux jambes ; variante facile sans matériel",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — unité secondes",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — unité mètres",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — unité secondes",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — unité secondes",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — unité secondes",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — unité secondes",
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
      "notes": "Musculation — unité secondes",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "name": "Glute Kickback (câble)",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation (M1) — jamais tiré en metcon",
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
      "notes": "Musculation — mains sur box / banc / marche ; variante facile sans matériel",
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
        "unit": "reps"
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
      "notes": "Musculation — variante facile sans matériel",
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
        "unit": "reps"
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
      "notes": "Musculation — reps alternées ; variante facile sans matériel",
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
        "unit": "reps"
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
      "notes": "Musculation — sans charge ; reps alternées ; variante facile sans matériel",
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
        "unit": "reps"
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
      "notes": "Musculation — unité secondes ; variante facile sans matériel",
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
        "unit": "s"
      }
    }
  ]
} as Catalog;
