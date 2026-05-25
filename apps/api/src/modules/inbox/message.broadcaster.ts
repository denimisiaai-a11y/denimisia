import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { InboxMessage } from '@prisma/client';

interface AdminEvent {
  threadId: string;
  message: InboxMessage;
}

const BUFFER_SIZE = 50;

@Injectable()
export class MessageBroadcaster {
  private threadSubjects = new Map<string, Subject<InboxMessage>>();
  private adminSubject = new Subject<AdminEvent>();
  private buffers = new Map<string, InboxMessage[]>();

  private getThreadSubject(threadId: string): Subject<InboxMessage> {
    let s = this.threadSubjects.get(threadId);
    if (!s) {
      s = new Subject<InboxMessage>();
      this.threadSubjects.set(threadId, s);
    }
    return s;
  }

  publishThread(threadId: string, message: InboxMessage): void {
    const buf = this.buffers.get(threadId) ?? [];
    buf.push(message);
    while (buf.length > BUFFER_SIZE) buf.shift();
    this.buffers.set(threadId, buf);

    this.getThreadSubject(threadId).next(message);
    this.adminSubject.next({ threadId, message });
  }

  subscribeThread(threadId: string): Observable<InboxMessage> {
    return this.getThreadSubject(threadId).asObservable();
  }

  subscribeAdmin(): Observable<AdminEvent> {
    return this.adminSubject.asObservable();
  }

  getReplayBuffer(threadId: string): InboxMessage[] {
    return [...(this.buffers.get(threadId) ?? [])];
  }

  replayAfter(threadId: string, lastMessageId: string): InboxMessage[] {
    const buf = this.buffers.get(threadId) ?? [];
    const idx = buf.findIndex((m) => m.id === lastMessageId);
    return idx === -1 ? buf : buf.slice(idx + 1);
  }
}
