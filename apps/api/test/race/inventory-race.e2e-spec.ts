describe('Inventory race protection (e2e)', () => {
  describe.skip('single-variant race', () => {
    it.todo(
      'two concurrent createOrder calls on a stock=1 variant: exactly one fulfills, exactly one rejects with BadRequestException("Insufficient stock for variant ...")',
    );

    it.todo('post-race ProductVariant.stock equals 0 (never -1)');

    it.todo('exactly one Order row exists for the contested variantId');

    it.todo(
      'exactly one InventoryLog row of type SALE exists for the contested variantId',
    );
  });

  describe.skip('bundle constituent race', () => {
    it.todo(
      'two concurrent bundle orders on a bundle whose only Black/L constituent variant has stock=1: exactly one fulfills, exactly one rejects',
    );

    it.todo('post-race constituent variant stock equals 0 (never -1)');

    it.todo('exactly one Order row exists for the contested bundleId');

    it.todo(
      'exactly one InventoryLog row of type SALE exists for the constituent variantId',
    );
  });
});
