export class Tick {
  public readonly index: number;
  public readonly spacing: number;
  public readonly isFlipped: boolean;

  constructor(index: number, spacing: number, isFlipped: boolean) {
    this.index = index;
    this.spacing = spacing;
    this.isFlipped = isFlipped;
  }

  public previousTick(): Tick {
    // return new Tick(this.index - this.spacing, this.spacing, this.isFlipped);
    if (this.isFlipped) {
      return new Tick(this.index - this.spacing, this.spacing, this.isFlipped);
    } else {
      return new Tick(this.index + this.spacing, this.spacing, this.isFlipped);
    }
  }

  public nextTick(): Tick {
    // return new Tick(this.index + this.spacing, this.spacing, this.isFlipped);
    if (this.isFlipped) {
      return new Tick(this.index + this.spacing, this.spacing, this.isFlipped);
    } else {
      return new Tick(this.index - this.spacing, this.spacing, this.isFlipped);
    }
  }
}
