// Exercices de catalogue-musculation-v1.csv déjà présents dans le catalogue
// metcon (recon M1, E1) : ils reçoivent les colonnes musculation sur la ligne
// existante, pas une seconde ligne. Clé = id CSV, valeur = id movement_catalog.
// 14 lignes marquées « même mouvement » en note + 5 présentes par nom
// (Front Squat, Lunges, Ring Rows, Box Step-ups, Banded Pull-Ups) ; Bench Press et Strict Press
// portent déjà l'id du catalogue.
module.exports = {
  push_up_m: 'push_up',
  deadlift_m: 'deadlift',
  back_squat_m: 'back_squat',
  front_squat_m: 'front_squat',
  goblet_squat_m: 'kb_goblet_squat',
  db_walking_lunge: 'db_lunge',
  step_up_m: 'box_step_up',
  plank_m: 'plank_hold',
  farmer_carry_m: 'db_farmer_carry',
  pike_push_up_m: 'pike_push_up',
  handstand_push_up_m: 'handstand_push_up',
  hanging_knee_raise_m: 'hanging_knee_raise',
  bodyweight_squat: 'air_squat',
  bodyweight_lunge: 'walking_lunge',
  pistol_m: 'pistol',
  inverted_row: 'ring_row',
  banded_pull_up_m: 'pull_up_banded',
  bench_press: 'bench_press',
  strict_press: 'strict_press',
};
