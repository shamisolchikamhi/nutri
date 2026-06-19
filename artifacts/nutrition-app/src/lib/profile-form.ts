import { z } from "zod";
import type { UserProfile, UserProfileInput } from "@workspace/api-client-react";

export const DIET_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "high_protein", label: "High Protein" },
  { value: "low_calorie", label: "Low Calorie" },
  { value: "low_carb", label: "Low Carb" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "halal", label: "Halal" },
] as const;

export const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly_active", label: "Lightly Active" },
  { value: "moderately_active", label: "Moderately Active" },
  { value: "very_active", label: "Very Active" },
  { value: "extra_active", label: "Extra Active" },
] as const;

const dietSchema = z.enum(["standard", "high_protein", "low_calorie", "low_carb", "vegan", "vegetarian", "halal"]);

function requiredNumber(label: string, min: number, max: number, whole = false) {
  return z.string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => Number.isFinite(Number(value)), `${label} must be a number`)
    .transform(Number)
    .pipe(
      z.number()
        .min(min, `${label} must be at least ${min}`)
        .max(max, `${label} must be at most ${max}`)
        .refine((value) => !whole || Number.isInteger(value), `${label} must be a whole number`),
    );
}

export const profileFormSchema = z.object({
  sex: z.enum(["male", "female", "other"]),
  ageYears: requiredNumber("Age", 13, 120, true),
  currentWeightKg: requiredNumber("Current weight", 25, 350),
  targetWeightKg: requiredNumber("Target weight", 25, 350),
  heightCm: requiredNumber("Height", 100, 250),
  bodyFatPercent: z.union([z.literal(""), requiredNumber("Body fat", 2, 75)]).transform((value) => value === "" ? null : value),
  dietPreference: dietSchema,
  dietPreferences: z.array(dietSchema).min(1, "Choose a diet preference"),
  activityLevel: z.enum(["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"]),
  budgetWeekly: requiredNumber("Weekly budget", 0, 1_000_000),
  mealFrequency: requiredNumber("Meals per day", 1, 6, true),
  retailerPreferences: z.array(z.number().int().positive()),
});

export type ProfileForm = z.input<typeof profileFormSchema>;
export type ProfileField = keyof ProfileForm;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export function createEmptyProfileForm(): ProfileForm {
  return {
    sex: "male",
    ageYears: "",
    currentWeightKg: "",
    targetWeightKg: "",
    heightCm: "",
    bodyFatPercent: "",
    dietPreference: "standard",
    dietPreferences: ["standard"],
    activityLevel: "moderately_active",
    budgetWeekly: "150",
    mealFrequency: "3",
    retailerPreferences: [],
  };
}

export function profileToForm(profile: UserProfile): ProfileForm {
  return {
    sex: profile.sex,
    ageYears: String(profile.ageYears),
    currentWeightKg: String(profile.currentWeightKg),
    targetWeightKg: String(profile.targetWeightKg),
    heightCm: String(profile.heightCm),
    bodyFatPercent: profile.bodyFatPercent == null ? "" : String(profile.bodyFatPercent),
    dietPreference: profile.dietPreference,
    dietPreferences: [profile.dietPreference],
    activityLevel: profile.activityLevel,
    budgetWeekly: String(profile.budgetWeekly),
    mealFrequency: String(profile.mealFrequency),
    retailerPreferences: profile.retailerPreferences ?? [],
  };
}

export function validateProfile(form: ProfileForm, fields?: ProfileField[]) {
  const result = profileFormSchema.safeParse(form);
  if (result.success) return { input: serializeProfile(result.data), errors: {} as ProfileErrors };

  const allowedFields = fields ? new Set<ProfileField>(fields) : null;
  const errors: ProfileErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ProfileField | undefined;
    if (field && (!allowedFields || allowedFields.has(field)) && !errors[field]) errors[field] = issue.message;
  }
  return { input: null, errors };
}

export function serializeProfile(data: z.output<typeof profileFormSchema>): UserProfileInput {
  return {
    sex: data.sex,
    ageYears: data.ageYears,
    currentWeightKg: data.currentWeightKg,
    targetWeightKg: data.targetWeightKg,
    heightCm: data.heightCm,
    bodyFatPercent: data.bodyFatPercent,
    dietPreference: data.dietPreferences[0] ?? data.dietPreference,
    activityLevel: data.activityLevel,
    budgetWeekly: data.budgetWeekly,
    mealFrequency: data.mealFrequency,
    retailerPreferences: data.retailerPreferences,
  };
}

export function toggleDiet(form: ProfileForm, value: ProfileForm["dietPreference"]): ProfileForm {
  if (value === "standard") return { ...form, dietPreference: value, dietPreferences: [value] };
  const selected = form.dietPreferences.filter((preference) => preference !== "standard");
  const next = selected.includes(value) ? selected.filter((preference) => preference !== value) : [...selected, value];
  const dietPreferences = next.length ? next : ["standard" as const];
  return { ...form, dietPreference: dietPreferences[0], dietPreferences };
}

export function toggleRetailer(form: ProfileForm, id: number): ProfileForm {
  const retailerPreferences = form.retailerPreferences.includes(id)
    ? form.retailerPreferences.filter((retailerId) => retailerId !== id)
    : [...form.retailerPreferences, id];
  return { ...form, retailerPreferences };
}
