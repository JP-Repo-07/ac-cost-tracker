export type ConsumptionInput = { ratedWatts: number; hoursPerDay: number; daysPerMonth: number; electricityRate: number; factor?: number };
export function calculateConsumption(input: ConsumptionInput) {
  const { ratedWatts, hoursPerDay, daysPerMonth, electricityRate, factor = 1 } = input;
  if (![ratedWatts, hoursPerDay, daysPerMonth, electricityRate, factor].every(Number.isFinite) || ratedWatts <= 0 || hoursPerDay < 0 || hoursPerDay > 24 || !Number.isInteger(daysPerMonth) || daysPerMonth < 1 || daysPerMonth > 31 || electricityRate < 0 || factor < 0 || factor > 1) throw new Error('Invalid calculation inputs');
  const averageWatts = ratedWatts * factor;
  const dailyKwh = averageWatts * hoursPerDay / 1000;
  const period = (days: number) => ({ kwh: dailyKwh * days, cost: dailyKwh * days * electricityRate });
  return { ratedWatts, averageWatts, daily: period(1), weekly: period(7), monthly: period(daysPerMonth) };
}
