export const poundsPerKg=2.2046226218487757;
export function toKilograms(value,unit='kg'){return value/(unit==='lb'?poundsPerKg:1);}
export function fromKilograms(value,unit='kg'){return value*(unit==='lb'?poundsPerKg:1);}
