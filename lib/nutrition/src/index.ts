export type NutritionTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const DEFAULT_NUTRITION_TARGETS: Readonly<NutritionTargets> = Object.freeze({
  calories: 2_000,
  proteinG: 150,
  carbsG: 200,
  fatG: 60,
});

export const DEFAULT_HYDRATION_TARGET_ML = 2_500;

export function roundNutrition(value: number) {
  return Math.round(value * 10) / 10;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
