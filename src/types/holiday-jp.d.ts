// src/types/holiday-jp.d.ts
declare module "holiday-jp" {
  export interface Holiday {
    date: Date
    name: string
  }

  export function isHoliday(date: Date): boolean
  export function between(start: Date, end: Date): Holiday[]
}
