export type Exposure = 'none' | 'very-slight' | 'moderate' | 'exposed' | 'very-exposed';
export interface UsageLog {
  id: string;
  start: string; // Local ISO datetime without timezone (YYYY-MM-DDTHH:mm)
  end: string;
  temperature: number;
  modelId: string | null;
  modelName: string;
  ratedWatts: number;
  rate: number;
  factor: number;
  roomAreaM2: number;
  exposure: Exposure;
  notes: string;
  createdAt: string;
}
