export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock extends Clock {
  constructor(private fixed: Date) {
    super();
  }

  now(): Date {
    return this.fixed;
  }

  set(date: Date) {
    this.fixed = date;
  }
}
