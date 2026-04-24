export class LowStockEvent {
  constructor(
    public readonly variantId: string,
    public readonly productName: string,
    public readonly currentStock: number,
    public readonly threshold: number,
  ) {}
}
