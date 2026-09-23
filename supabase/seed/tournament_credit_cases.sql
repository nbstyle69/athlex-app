-- Généré par scripts/generate-badge-rules.mjs depuis tournament_credit_cases.json.
-- Ne pas éditer : la source est le .json, ce fichier n'est qu'un transport
-- vers psql. Chargé par \i depuis supabase/tests/tournament_credits.sql.
CREATE TEMP TABLE cas_credits (donnees jsonb);
INSERT INTO cas_credits VALUES ($cas${
  "_lisez_moi": "Cas partagés du crédit des scores de tournoi : un WOD structuré (movement_lines en ids de movement_catalog) et un score validé → les crédits dus, en clés canoniques. `attendus` est EXHAUSTIF (une ligne par mouvement et unité, après addition). Le serveur est jugé dessus par supabase/tests/tournament_credits.sql ; le client (computeCompletedMovements) le sera dans le lot client. Règle : jamais plus que ce que le score prouve ; en cas d'ambiguïté, rien.",
  "cas": [
    {
      "nom": "For Time terminé : Murph, deux lignes de course additionnées",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "run",
            "unit": "m",
            "qty_male": 1600
          },
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 100
          },
          {
            "movement": "push_up",
            "unit": "reps",
            "qty_male": 200
          },
          {
            "movement": "air_squat",
            "unit": "reps",
            "qty_male": 300
          },
          {
            "movement": "run",
            "unit": "m",
            "qty_male": 1600
          }
        ]
      },
      "score": {
        "score_value": "2700",
        "capped": false
      },
      "attendus": [
        {
          "movement": "air_squat",
          "unit": "reps",
          "quantite": 300
        },
        {
          "movement": "pull_up",
          "unit": "reps",
          "quantite": 100
        },
        {
          "movement": "push_up",
          "unit": "reps",
          "quantite": 200
        },
        {
          "movement": "run",
          "unit": "m",
          "quantite": 3200
        }
      ]
    },
    {
      "nom": "For Time terminé : 5 tours",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": 5,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "double_under",
            "unit": "reps",
            "qty_male": 100
          },
          {
            "movement": "toes_to_bar",
            "unit": "reps",
            "qty_male": 20
          }
        ]
      },
      "score": {
        "score_value": "1200",
        "capped": false
      },
      "attendus": [
        {
          "movement": "double_under",
          "unit": "reps",
          "quantite": 500
        },
        {
          "movement": "toes_to_bar",
          "unit": "reps",
          "quantite": 100
        }
      ]
    },
    {
      "nom": "For Time terminé : le temps n'a pas à être lisible pour prouver la fin",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "wall_ball",
            "unit": "reps",
            "qty_male": 150
          }
        ]
      },
      "score": {
        "score_value": "12:30",
        "capped": false
      },
      "attendus": [
        {
          "movement": "wall_ball",
          "unit": "reps",
          "quantite": 150
        }
      ]
    },
    {
      "nom": "For Time au CAP : reps du score réparties dans l'ordre",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": 3,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "thruster",
            "unit": "reps",
            "qty_male": 21
          },
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 21
          }
        ]
      },
      "score": {
        "score_value": "100",
        "capped": true
      },
      "attendus": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "quantite": 42
        },
        {
          "movement": "thruster",
          "unit": "reps",
          "quantite": 58
        }
      ]
    },
    {
      "nom": "For Time au CAP : jamais plus que la prescription",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": 3,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "thruster",
            "unit": "reps",
            "qty_male": 21
          },
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 21
          }
        ]
      },
      "score": {
        "score_value": "500",
        "capped": true
      },
      "attendus": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "quantite": 63
        },
        {
          "movement": "thruster",
          "unit": "reps",
          "quantite": 63
        }
      ]
    },
    {
      "nom": "For Time : l'ancien encodage 999999 + reps est un CAP",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "thruster",
            "unit": "reps",
            "qty_male": 21
          },
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 21
          }
        ]
      },
      "score": {
        "score_value": "1000019",
        "capped": false
      },
      "attendus": [
        {
          "movement": "thruster",
          "unit": "reps",
          "quantite": 20
        }
      ]
    },
    {
      "nom": "For Time au CAP : score illisible, rien",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "thruster",
            "unit": "reps",
            "qty_male": 21
          }
        ]
      },
      "score": {
        "score_value": "CAP",
        "capped": true
      },
      "attendus": []
    },
    {
      "nom": "AMRAP : tours complets puis reste ; des calories comptent comme des reps du tour",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "row",
            "unit": "cal",
            "qty_male": 20
          },
          {
            "movement": "burpee",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "95",
        "capped": false
      },
      "attendus": [
        {
          "movement": "burpee",
          "unit": "reps",
          "quantite": 30
        },
        {
          "movement": "row",
          "unit": "cal",
          "quantite": 65
        }
      ]
    },
    {
      "nom": "AMRAP : reps_per_round égal à la somme des lignes, crédité",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": 30,
        "movement_lines": [
          {
            "movement": "row",
            "unit": "cal",
            "qty_male": 20
          },
          {
            "movement": "burpee",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "95",
        "capped": false
      },
      "attendus": [
        {
          "movement": "burpee",
          "unit": "reps",
          "quantite": 30
        },
        {
          "movement": "row",
          "unit": "cal",
          "quantite": 65
        }
      ]
    },
    {
      "nom": "AMRAP : reps_per_round différent de la somme, on ne sait pas quel tour compter, rien",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": 25,
        "movement_lines": [
          {
            "movement": "row",
            "unit": "cal",
            "qty_male": 20
          },
          {
            "movement": "burpee",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "95",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "AMRAP : une ligne sans correspondance compte dans la répartition, sans être créditée",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "arnold_press",
            "unit": "reps",
            "qty_male": 10
          },
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "25",
        "capped": false
      },
      "attendus": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "quantite": 10
        }
      ]
    },
    {
      "nom": "AMRAP : score « tours + reps », illisible comme entier, rien",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 5
          },
          {
            "movement": "push_up",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "5+12",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "AMRAP : score nul, rien",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 5
          }
        ]
      },
      "score": {
        "score_value": "0",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "AMRAP avec une ligne en mètres, sans reps_per_round : le score ne dit pas s'il compte les mètres, rien",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "run",
            "unit": "m",
            "qty_male": 200
          },
          {
            "movement": "burpee",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "420",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "AMRAP avec une ligne en mètres, reps_per_round confirmant le total : crédit réparti",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": 210,
        "movement_lines": [
          {
            "movement": "run",
            "unit": "m",
            "qty_male": 200
          },
          {
            "movement": "burpee",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "525",
        "capped": false
      },
      "attendus": [
        {
          "movement": "burpee",
          "unit": "reps",
          "quantite": 20
        },
        {
          "movement": "run",
          "unit": "m",
          "quantite": 505
        }
      ]
    },
    {
      "nom": "AMRAP avec des calories seulement : les calories comptent comme des reps, crédité",
      "genre": "male",
      "wod": {
        "type": "AMRAP",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "bike_erg",
            "unit": "cal",
            "qty_male": 15
          },
          {
            "movement": "air_squat",
            "unit": "reps",
            "qty_male": 15
          }
        ]
      },
      "score": {
        "score_value": "70",
        "capped": false
      },
      "attendus": [
        {
          "movement": "air_squat",
          "unit": "reps",
          "quantite": 30
        },
        {
          "movement": "bike",
          "unit": "cal",
          "quantite": 40
        }
      ]
    },
    {
      "nom": "For Time au CAP avec une ligne en mètres, sans reps_per_round : rien",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": 3,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "run",
            "unit": "m",
            "qty_male": 400
          },
          {
            "movement": "thruster",
            "unit": "reps",
            "qty_male": 21
          }
        ]
      },
      "score": {
        "score_value": "300",
        "capped": true
      },
      "attendus": []
    },
    {
      "nom": "For Time au CAP avec une ligne en mètres, reps_per_round confirmant le total : crédit réparti",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": 3,
        "reps_per_round": 421,
        "movement_lines": [
          {
            "movement": "run",
            "unit": "m",
            "qty_male": 400
          },
          {
            "movement": "thruster",
            "unit": "reps",
            "qty_male": 21
          }
        ]
      },
      "score": {
        "score_value": "500",
        "capped": true
      },
      "attendus": [
        {
          "movement": "run",
          "unit": "m",
          "quantite": 479
        },
        {
          "movement": "thruster",
          "unit": "reps",
          "quantite": 21
        }
      ]
    },
    {
      "nom": "EMOM : le score n'a pas de sémantique structurée, rien",
      "genre": "male",
      "wod": {
        "type": "EMOM",
        "rounds": 10,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "bike_erg",
            "unit": "cal",
            "qty_male": 15
          }
        ]
      },
      "score": {
        "score_value": "10",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "Tabata sur un seul mouvement : le score en reps",
      "genre": "male",
      "wod": {
        "type": "Tabata",
        "rounds": 8,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "air_squat",
            "unit": "reps",
            "qty_male": 20
          }
        ]
      },
      "score": {
        "score_value": "120",
        "capped": false
      },
      "attendus": [
        {
          "movement": "air_squat",
          "unit": "reps",
          "quantite": 120
        }
      ]
    },
    {
      "nom": "Tabata sur deux mouvements : à qui imputer le score ? rien",
      "genre": "male",
      "wod": {
        "type": "Tabata",
        "rounds": 8,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "air_squat",
            "unit": "reps",
            "qty_male": 20
          },
          {
            "movement": "push_up",
            "unit": "reps",
            "qty_male": 10
          }
        ]
      },
      "score": {
        "score_value": "120",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "Max Reps sur un seul mouvement : le score",
      "genre": "male",
      "wod": {
        "type": "Max Reps",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "double_under",
            "unit": "reps",
            "qty_male": 1
          }
        ]
      },
      "score": {
        "score_value": "150",
        "capped": false
      },
      "attendus": [
        {
          "movement": "double_under",
          "unit": "reps",
          "quantite": 150
        }
      ]
    },
    {
      "nom": "Max Reps sur deux mouvements : rien",
      "genre": "male",
      "wod": {
        "type": "Max Reps",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "double_under",
            "unit": "reps",
            "qty_male": 1
          },
          {
            "movement": "single_under",
            "unit": "reps",
            "qty_male": 1
          }
        ]
      },
      "score": {
        "score_value": "150",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "Strength : rien",
      "genre": "male",
      "wod": {
        "type": "Strength",
        "rounds": 5,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "deadlift",
            "unit": "reps",
            "qty_male": 5
          }
        ]
      },
      "score": {
        "score_value": "140",
        "capped": false
      },
      "attendus": []
    },
    {
      "nom": "Split ♂/♀ : une athlète reçoit la quantité ♀",
      "genre": "female",
      "wod": {
        "type": "For Time",
        "rounds": 5,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "wall_ball",
            "unit": "reps",
            "qty_male": 20,
            "qty_female": 14
          }
        ]
      },
      "score": {
        "score_value": "600",
        "capped": false
      },
      "attendus": [
        {
          "movement": "wall_ball",
          "unit": "reps",
          "quantite": 70
        }
      ]
    },
    {
      "nom": "Split ♂/♀ : un athlète reçoit la quantité ♂",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": 5,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "wall_ball",
            "unit": "reps",
            "qty_male": 20,
            "qty_female": 14
          }
        ]
      },
      "score": {
        "score_value": "600",
        "capped": false
      },
      "attendus": [
        {
          "movement": "wall_ball",
          "unit": "reps",
          "quantite": 100
        }
      ]
    },
    {
      "nom": "Split ♂/♀ : sans sexe renseigné, la quantité la plus basse",
      "genre": null,
      "wod": {
        "type": "For Time",
        "rounds": 5,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "wall_ball",
            "unit": "reps",
            "qty_male": 20,
            "qty_female": 14
          }
        ]
      },
      "score": {
        "score_value": "600",
        "capped": false
      },
      "attendus": [
        {
          "movement": "wall_ball",
          "unit": "reps",
          "quantite": 70
        }
      ]
    },
    {
      "nom": "Split ♂/♀ : sans quantité ♀, la même pour une athlète",
      "genre": "female",
      "wod": {
        "type": "For Time",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "pull_up",
            "unit": "reps",
            "qty_male": 30
          }
        ]
      },
      "score": {
        "score_value": "400",
        "capped": false
      },
      "attendus": [
        {
          "movement": "pull_up",
          "unit": "reps",
          "quantite": 30
        }
      ]
    },
    {
      "nom": "Famille : deux variantes de clean créditent la même clé",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "power_clean",
            "unit": "reps",
            "qty_male": 30
          },
          {
            "movement": "squat_clean",
            "unit": "reps",
            "qty_male": 20
          }
        ]
      },
      "score": {
        "score_value": "500",
        "capped": false
      },
      "attendus": [
        {
          "movement": "clean",
          "unit": "reps",
          "quantite": 50
        }
      ]
    },
    {
      "nom": "For Time terminé sur un mouvement sans correspondance : rien",
      "genre": "male",
      "wod": {
        "type": "For Time",
        "rounds": null,
        "reps_per_round": null,
        "movement_lines": [
          {
            "movement": "arnold_press",
            "unit": "reps",
            "qty_male": 50
          }
        ]
      },
      "score": {
        "score_value": "300",
        "capped": false
      },
      "attendus": []
    }
  ]
}$cas$::jsonb);
