import { BotSuggestService } from './bot-suggest.service';

describe('BotSuggestService', () => {
  const fallback = { answer: jest.fn() };
  const svc = new BotSuggestService(fallback as never);

  beforeEach(() => {
    fallback.answer.mockReset();
  });

  it('returns the LLM fallback answer for any customer message', async () => {
    fallback.answer.mockResolvedValue({
      message: 'We do not currently carry shoes. Our line is denim jackets, jeans, tees, and sweaters.',
      chips: ['Leave a message'],
    });
    const out = await svc.suggest('Do you guys have shoes');
    expect(out.body).toMatch(/do not currently carry shoes/);
    expect(fallback.answer).toHaveBeenCalledWith({
      message: 'Do you guys have shoes',
      sessionId: 'admin-suggest',
    });
  });

  it('passes the LLM answer through verbatim', async () => {
    fallback.answer.mockResolvedValue({
      message: "I can't help with that one. Try /track-order to check on an order, or leave a message for our team.",
      chips: ['Track my order', 'Leave a message'],
    });
    const out = await svc.suggest('what is your stance on climate change');
    expect(out.body).toMatch(/can't help/);
  });
});
