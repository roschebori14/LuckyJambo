import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CM', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function calculateWinnings(stake: number, feePercent: number = 20): {
  pot: number;
  fee: number;
  winnerReceives: number;
} {
  const pot = stake * 2;
  const fee = Math.floor(pot * (feePercent / 100));
  const winnerReceives = pot - fee;
  return { pot, fee, winnerReceives };
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateReferenceId(): string {
  return `LJ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}
