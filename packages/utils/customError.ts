export class CustomError {
  private message: string;
  private details: string; // 细节

  constructor(message: string, details?: any) {
    this.message = message;
    this.details = details;
  }

  public toString() {
    return `message=${this.message}`;
  }

  public toJSON() {
    return { message: this.message, details: this.details };
  }
}
