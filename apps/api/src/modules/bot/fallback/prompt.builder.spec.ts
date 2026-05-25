import { PromptBuilder } from './prompt.builder';
import { RetrievedContext } from './kb.retriever';

describe('PromptBuilder', () => {
  const pb = new PromptBuilder();

  const ctx: RetrievedContext = {
    faqChunks: [{ heading: 'What we sell', body: 'We sell jeans and jackets.' }],
    products: [],
    userOrders: [
      { id: 'o1', orderNumber: 'DEN-1042', status: 'CONFIRMED', createdAt: new Date('2026-05-23') },
    ],
  };

  it('includes the SYSTEM directive', () => {
    const { system } = pb.compose('do you sell hoodies', ctx);
    expect(system).toMatch(/Denimisia/);
    expect(system).toMatch(/short sentences/i);
  });

  it('includes FAQ heading and body', () => {
    const { user } = pb.compose('do you sell hoodies', ctx);
    expect(user).toContain('What we sell');
    expect(user).toContain('We sell jeans and jackets.');
  });

  it('includes user order data when present', () => {
    const { user } = pb.compose('where is my order', ctx);
    expect(user).toContain('DEN-1042');
    expect(user).toContain('CONFIRMED');
  });

  it('marks USER section verbatim', () => {
    const { user } = pb.compose('hello there', ctx);
    expect(user).toMatch(/USER:\s+hello there\s*$/);
  });
});
