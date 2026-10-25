export interface DietPdfPayload {
  id: string;
  tenantId: string;
  patientId: string;
  nutritionistId: string;
  name: string;
  objective: string;
  phase: string | null;
  approach: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  mealsPerDay: number;
  mainRestriction: string | null;
  notes: string | null;
  estimatedCalories: number;
  adherencePercent: number | null;
  patientFullName: string;
  nutritionistFullName: string;
  days: DietPdfDay[];
}

export interface DietPdfDay {
  id: string;
  dietPlanId: string;
  dayLabel: string;
  dayOrder: number;
  meals: DietPdfMeal[];
}

export interface DietPdfMeal {
  id: string;
  dietPlanDayId: string;
  name: string;
  mealOrder: number;
  targetCalories: number;
  notes: string | null;
  items: DietPdfMealItem[];
}

export interface DietPdfMealItem {
  id: string;
  dietMealId: string;
  name: string;
  portion: string | null;
  calories: number;
  itemOrder: number;
  notes: string | null;
}

export function mapDietPlanToPdfPayload(dietPlan: any): DietPdfPayload {
  const weekDays = [...(dietPlan.days ?? [])]
    .sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0))
    .map((day) => mapDay(day));

  return {
    id: String(dietPlan.id),
    tenantId: String(dietPlan.tenantId),
    patientId: String(dietPlan.patientId),
    nutritionistId: String(dietPlan.nutritionistId),
    name: dietPlan.name || '',
    objective: dietPlan.objective || '',
    phase: dietPlan.phase ?? null,
    approach: dietPlan.approach ?? null,
    startDate: toIsoDate(dietPlan.startDate),
    endDate: toIsoDate(dietPlan.endDate),
    status: dietPlan.status || 'ACTIVE',
    mealsPerDay: Number(dietPlan.mealsPerDay) || 0,
    mainRestriction: dietPlan.mainRestriction ?? null,
    notes: dietPlan.notes ?? null,
    estimatedCalories: Number(dietPlan.estimatedCalories) || 0,
    adherencePercent: dietPlan.adherencePercent !== undefined ? Number(dietPlan.adherencePercent) : null,
    patientFullName: dietPlan.patientFullName || [dietPlan.patient?.firstName, dietPlan.patient?.lastName].filter(Boolean).join(' ') || 'Paciente',
    nutritionistFullName: dietPlan.nutritionistFullName || [dietPlan.nutritionist?.firstName, dietPlan.nutritionist?.lastName].filter(Boolean).join(' ') || 'Nutricionista',
    days: weekDays,
  };
}

function mapDay(day: any): DietPdfDay {
  const meals = [...(day.meals ?? [])]
    .sort((a, b) => (a.mealOrder ?? 0) - (b.mealOrder ?? 0))
    .map((meal) => mapMeal(meal));

  return {
    id: String(day.id),
    dietPlanId: String(day.dietPlanId),
    dayLabel: day.dayLabel || '',
    dayOrder: Number(day.dayOrder) || 0,
    meals,
  };
}

function mapMeal(meal: any): DietPdfMeal {
  const items = [...(meal.items ?? [])]
    .sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0))
    .map((item) => mapItem(item));

  return {
    id: String(meal.id),
    dietPlanDayId: String(meal.dietPlanDayId),
    name: meal.name || '',
    mealOrder: Number(meal.mealOrder) || 0,
    targetCalories: Number(meal.targetCalories) || 0,
    notes: meal.notes ?? null,
    items,
  };
}

function mapItem(item: any): DietPdfMealItem {
  return {
    id: String(item.id),
    dietMealId: String(item.dietMealId),
    name: item.name || '',
    portion: item.portion ?? null,
    calories: Number(item.calories) || 0,
    itemOrder: Number(item.itemOrder) || 0,
    notes: item.notes ?? null,
  };
}

function toIsoDate(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
