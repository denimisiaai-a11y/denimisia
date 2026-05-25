import { MessageBroadcaster } from './message.broadcaster';
import { InboxMessage } from '@prisma/client';

const msg = (id: string): InboxMessage => ({ id }) as InboxMessage;

describe('MessageBroadcaster', () => {
  it('fans out to multiple subscribers for the same thread', (done) => {
    const b = new MessageBroadcaster();
    const received: string[] = [];
    const sub1 = b.subscribeThread('t1').subscribe((m) => received.push(`1:${m.id}`));
    const sub2 = b.subscribeThread('t1').subscribe((m) => received.push(`2:${m.id}`));
    b.publishThread('t1', msg('m1'));
    setTimeout(() => {
      expect(received).toEqual(['1:m1', '2:m1']);
      sub1.unsubscribe();
      sub2.unsubscribe();
      done();
    }, 10);
  });

  it('does not deliver to subscribers of a different thread', (done) => {
    const b = new MessageBroadcaster();
    const received: string[] = [];
    b.subscribeThread('t1').subscribe((m) => received.push(m.id));
    b.publishThread('t2', msg('m1'));
    setTimeout(() => {
      expect(received).toEqual([]);
      done();
    }, 10);
  });

  it('keeps a replay buffer of the last 50 messages per thread', () => {
    const b = new MessageBroadcaster();
    for (let i = 1; i <= 60; i++) b.publishThread('t1', msg(`m${i}`));
    const buf = b.getReplayBuffer('t1');
    expect(buf.length).toBe(50);
    expect(buf[0].id).toBe('m11');
    expect(buf.at(-1)?.id).toBe('m60');
  });

  it('returns messages newer than lastMessageId from the buffer', () => {
    const b = new MessageBroadcaster();
    for (let i = 1; i <= 10; i++) b.publishThread('t1', msg(`m${i}`));
    const after = b.replayAfter('t1', 'm7');
    expect(after.map((m) => m.id)).toEqual(['m8', 'm9', 'm10']);
  });

  it('admin channel receives publishes from all threads', (done) => {
    const b = new MessageBroadcaster();
    const received: string[] = [];
    b.subscribeAdmin().subscribe((evt) => received.push(`${evt.threadId}:${evt.message.id}`));
    b.publishThread('t1', msg('m1'));
    b.publishThread('t2', msg('m5'));
    setTimeout(() => {
      expect(received).toEqual(['t1:m1', 't2:m5']);
      done();
    }, 10);
  });
});
