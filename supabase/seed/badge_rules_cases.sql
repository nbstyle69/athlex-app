-- Généré par scripts/generate-badge-rules.mjs depuis badge_rules_cases.json.
-- Ne pas éditer : la source est le .json, ce fichier n'est qu'un transport
-- vers psql. Chargé par \i depuis supabase/tests/badge_rules_mv.sql.
CREATE TEMP TABLE cas_parite (donnees jsonb);
INSERT INTO cas_parite VALUES ($cas${
  "_lisez_moi": "Cas de parité partagés entre le client (jest, src/__tests__/badgeRulesParite.test.ts) et le serveur (SQL, supabase/tests/badge_rules_mv.sql). Un seul fichier : deux jeux de cas divergeraient, et le plus indulgent deviendrait la vérité. `cumuls` décrit les lignes de user_movement_stats d'un athlète fictif ; `attendus` est la liste EXHAUSTIVE des badges mv_* que la décision doit accorder ; `refuses` sont des badges dont on exige explicitement le refus.",
  "cas": [
    {
      "nom": "palier atteint pile, en reps",
      "cumuls": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "total_reps": 100
        }
      ],
      "attendus": [
        "mv_pullup_100"
      ],
      "refuses": [
        "mv_pullup_500",
        "mv_pullup_1000",
        "mv_squat_100",
        "mv_polyvalent_5",
        "mv_total_10k"
      ]
    },
    {
      "nom": "une rep sous le seuil",
      "cumuls": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "total_reps": 99
        }
      ],
      "attendus": [],
      "refuses": [
        "mv_pullup_100"
      ]
    },
    {
      "nom": "unite metres : la course",
      "cumuls": [
        {
          "movement": "run",
          "unit": "m",
          "total_reps": 42195
        }
      ],
      "attendus": [
        "mv_run_10000",
        "mv_run_42195"
      ],
      "refuses": [
        "mv_run_100000",
        "mv_run_250000",
        "mv_total_10k",
        "mv_polyvalent_5"
      ]
    },
    {
      "nom": "unite calories : le rameur",
      "cumuls": [
        {
          "movement": "row",
          "unit": "cal",
          "total_reps": 500
        }
      ],
      "attendus": [
        "mv_row_500"
      ],
      "refuses": [
        "mv_row_2000",
        "mv_row_m_10000",
        "mv_bike_500",
        "mv_total_10k"
      ]
    },
    {
      "nom": "meme valeur, mauvaise unite : des metres ne sont pas des calories",
      "cumuls": [
        {
          "movement": "row",
          "unit": "m",
          "total_reps": 500
        }
      ],
      "attendus": [],
      "refuses": [
        "mv_row_500",
        "mv_row_m_10000",
        "mv_total_10k"
      ]
    },
    {
      "nom": "regroupement : les burpees box jump comptent aussi comme burpees",
      "cumuls": [
        {
          "movement": "burpee_box_jump",
          "unit": "reps",
          "total_reps": 100
        }
      ],
      "attendus": [
        "mv_burpee_100",
        "mv_burpee_bj_100"
      ],
      "refuses": [
        "mv_burpee_500",
        "mv_burpee_bj_500"
      ]
    },
    {
      "nom": "regroupement : les variantes de squat comptent comme squats",
      "cumuls": [
        {
          "movement": "air_squat",
          "unit": "reps",
          "total_reps": 500
        },
        {
          "movement": "goblet_squat",
          "unit": "reps",
          "total_reps": 100
        }
      ],
      "attendus": [
        "mv_air_squat_100",
        "mv_air_squat_500",
        "mv_goblet_squat_100",
        "mv_squat_100",
        "mv_squat_500"
      ],
      "refuses": [
        "mv_squat_1000",
        "mv_goblet_squat_500",
        "mv_polyvalent_5",
        "mv_total_10k"
      ]
    },
    {
      "nom": "mouvement different : un deadlift n'est pas une traction",
      "cumuls": [
        {
          "movement": "deadlift",
          "unit": "reps",
          "total_reps": 5000
        }
      ],
      "attendus": [
        "mv_deadlifts_100",
        "mv_deadlifts_500",
        "mv_deadlifts_1000",
        "mv_deadlifts_5000"
      ],
      "refuses": [
        "mv_pullup_100",
        "mv_squat_100",
        "mv_total_10k",
        "mv_polyvalent_5"
      ]
    },
    {
      "nom": "meta total : seules les reps comptent, les cles inconnues sont ignorees",
      "cumuls": [
        {
          "movement": "thruster",
          "unit": "reps",
          "total_reps": 5000
        },
        {
          "movement": "deadlift",
          "unit": "reps",
          "total_reps": 5000
        },
        {
          "movement": "row",
          "unit": "cal",
          "total_reps": 9000
        },
        {
          "movement": "work_hsw",
          "unit": "reps",
          "total_reps": 9999
        }
      ],
      "attendus": [
        "mv_thrusters_100",
        "mv_thrusters_500",
        "mv_thrusters_1000",
        "mv_thrusters_5000",
        "mv_deadlifts_100",
        "mv_deadlifts_500",
        "mv_deadlifts_1000",
        "mv_deadlifts_5000",
        "mv_row_500",
        "mv_row_2000",
        "mv_row_5000",
        "mv_total_10k"
      ],
      "refuses": [
        "mv_total_50k",
        "mv_total_100k",
        "mv_polyvalent_5"
      ]
    },
    {
      "nom": "meta polyvalence : cinq mouvements a cent reps, celui a 99 ne compte pas",
      "cumuls": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "push_up",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "sit_up",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "box_jump",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "lunge",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "v_up",
          "unit": "reps",
          "total_reps": 99
        },
        {
          "movement": "snatch_renfo",
          "unit": "reps",
          "total_reps": 5000
        }
      ],
      "attendus": [
        "mv_pullup_100",
        "mv_pushup_100",
        "mv_situp_100",
        "mv_box_jump_100",
        "mv_lunge_100",
        "mv_polyvalent_5"
      ],
      "refuses": [
        "mv_polyvalent_10",
        "mv_polyvalent_20",
        "mv_vup_100",
        "mv_total_10k"
      ]
    },
    {
      "nom": "meta polyvalence : quatre mouvements a cent reps ne suffisent pas",
      "cumuls": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "push_up",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "sit_up",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "box_jump",
          "unit": "reps",
          "total_reps": 100
        },
        {
          "movement": "lunge",
          "unit": "reps",
          "total_reps": 99
        },
        {
          "movement": "v_up",
          "unit": "reps",
          "total_reps": 99
        }
      ],
      "attendus": [
        "mv_pullup_100",
        "mv_pushup_100",
        "mv_situp_100",
        "mv_box_jump_100"
      ],
      "refuses": [
        "mv_polyvalent_5",
        "mv_lunge_100",
        "mv_vup_100",
        "mv_total_10k"
      ]
    },
    {
      "nom": "aucun cumul : rien n'est du",
      "cumuls": [],
      "attendus": [],
      "refuses": [
        "mv_pullup_100",
        "mv_run_10000",
        "mv_row_500",
        "mv_total_10k",
        "mv_polyvalent_5"
      ]
    }
  ]
}$cas$::jsonb);
