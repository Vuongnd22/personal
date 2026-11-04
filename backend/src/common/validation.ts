import { Matches } from 'class-validator';

/** Calendar date "YYYY-MM-DD" (spec §3.1). Combine with @IsOptional() to also accept null (clears the value). */
export const IsDateOnly = () => Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a date in YYYY-MM-DD format' });
